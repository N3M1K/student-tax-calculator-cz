import { Elysia, t } from "elysia";
import { initDB, db } from "./db";
import { join } from "path";

// Initialize DB
await initDB();

const app = new Elysia();

// Constants
const DEFAULT_SOCIAL_LIMIT = 105000;

// Helper to format currency
const formatCurrency = (amount: number) => {
  return amount.toLocaleString('cs-CZ');
};

// Helper inside src/index.ts to render invoice rows
const renderInvoiceRows = (invoices: any[]) => {
  if (invoices.length === 0) {
    return `<tr><td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">Žádné faktury.</td></tr>`;
  }
  return invoices.map(inv => `
    <tr>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${inv.date}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${inv.client_name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${formatCurrency(inv.amount)} Kč</td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button hx-delete="/invoices/${inv.id}" hx-target="body" hx-swap="outerHTML" class="text-red-600 hover:text-red-900">Smazat</button>
        </td>
    </tr>
  `).join('');
};

// Main Helper to calculate stats
async function getStats() {
    const invoicesResult = await db.execute("SELECT * FROM invoices ORDER BY date DESC");
    const settingsResult = await db.execute("SELECT * FROM settings WHERE key = 'social_limit_amount'");
    
    // Configurable limit
    const socialLimit = settingsResult.rows.length > 0 
        ? parseInt(settingsResult.rows[0].value as string) 
        : DEFAULT_SOCIAL_LIMIT;

    const invoices = invoicesResult.rows;
    
    // Revenue: Sum of all invoices (assuming paid as per prompt reqs for simplicity or filtering)
    // Prompt says: "Revenue (Příjmy): Sum of all paid invoices". We'll assume all added are paid for MVP flow, or strictly use is_paid.
    // Let's filter by is_paid if we were strict, but for MVP let's assume all entered are Revenue.
    // The previous plan said "Sum of amount where is_paid = 1".
    // But the schema set default to 0. So we should probably default it to 1 when adding, or just sum all.
    // I'll sum all for simplicity as "Invioce Management" implies valid revenue records.
    const revenue = invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
    
    // Expenses: Flat 60%
    const expenses = revenue * 0.6;
    
    // Profit: Revenue - Expenses (or Revenue * 0.4)
    const profit = revenue - expenses;
    
    // Health Insurance: Profit * 0.5 * 0.135
    // Assessment base is 50% of profit. Rate is 13.5%
    const healthInsurance = Math.ceil(profit * 0.5 * 0.135);
    
    // Social Security Message
    // If Profit > Limit => Pay. Else 0.
    const overLimit = profit > socialLimit;
    const socialSecurityMsg = overLimit 
        ? "MUSÍTE PLATIT (Limit překročen)" 
        : "0 Kč (Student do limitu)";

    return {
        revenue,
        profit,
        socialLimit,
        healthInsurance,
        socialSecurityMsg,
        invoices,
        year: new Date().getFullYear()
    };
}

// Render the full page
async function renderPage() {
    const stats = await getStats();
    const template = await Bun.file(join(import.meta.dir, "views/index.html")).text();
    
    // Simple substitution
    let html = template
        .replace(/{{revenue}}/g, formatCurrency(stats.revenue))
        .replace(/{{profitRaw}}/g, stats.profit.toString())
        .replace(/{{profit}}/g, formatCurrency(stats.profit))
        .replace(/{{limitRaw}}/g, stats.socialLimit.toString())
        .replace(/{{limit}}/g, formatCurrency(stats.socialLimit))
        .replace(/{{healthInsurance}}/g, formatCurrency(stats.healthInsurance))
        .replace(/{{socialSecurityMsg}}/g, stats.socialSecurityMsg)
        .replace(/{{year}}/g, stats.year.toString())
        .replace('{{invoiceRows}}', renderInvoiceRows(stats.invoices));
        
    return html;
}

app
    // Serve Dashboard
    .get("/", async () => {
        return new Response(await renderPage(), {
            headers: { "Content-Type": "text/html" }
        });
    })
    
    // Add Invoice
    .post("/invoices", async ({ body }) => {
        const { date, amount, client_name } = body as { date: string, amount: string, client_name: string };
        
        await db.execute({
            sql: "INSERT INTO invoices (date, amount, client_name, is_paid) VALUES (?, ?, ?, 1)",
            args: [date, parseInt(amount), client_name]
        });
        
        // Return updated page (HTMX handles body swap)
        // Ideally we just return the list or partials, but simply reloading the whole body 
        // ensures all stats update atomically without complex OOB swaps.
        // HTMX swap="outerHTML" on body allows full page refresh sensation without full reload if targeted right,
        // but here we targeted body.
        return new Response(await renderPage(), {
            headers: { "Content-Type": "text/html" }
        });
    })
    
    // Delete Invoice
    .delete("/invoices/:id", async ({ params: { id } }) => {
        await db.execute({
            sql: "DELETE FROM invoices WHERE id = ?",
            args: [id]
        });
        
        return new Response(await renderPage(), {
            headers: { "Content-Type": "text/html" }
        });
    })
    
    // Update Settings
    .post("/settings", async ({ body }) => {
        const { social_limit_amount } = body as { social_limit_amount: string };
        
        await db.execute({
            sql: "INSERT INTO settings (key, value) VALUES ('social_limit_amount', ?) ON CONFLICT(key) DO UPDATE SET value = ?",
            args: [social_limit_amount, social_limit_amount]
        });
        
        return new Response(await renderPage(), {
            headers: { "Content-Type": "text/html" }
        });
    })
    
    .listen(3000);

console.log(
  `Student Tax Guard is running at ${app.server?.hostname}:${app.server?.port}`
);
