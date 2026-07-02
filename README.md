# bizdocs
Web apps to support basic business operations in small organisations.

| App               | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `invoice/`        | Freelance/consulting invoices (taxes, FX, payment) as PDF      |
| `reimburse/`      | Expense reimbursement with attached receipts as PDF            |
| `timesheet/`      | Timesheets by employee type, work codes and signatures as PDF  |
| `contactmanager/` | Maintain a contact directory and publish a staff contact book  |

Each app is a single `index.html` plus a `config.yml` — no build step, no
backend. Serve the repository over HTTP and open an app folder:

```bash
python3 -m http.server 8000
# http://localhost:8000/invoice/  (or /reimburse/ , /timesheet/ , /contactmanager/)
```

See [CLAUDE.md](CLAUDE.md) for working on the code and [DESIGN.md](DESIGN.md)
for the design system.
