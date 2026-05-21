"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";

type Invoice = {
  id: string;
  invoice_number: string;
  total_amount: number;
  status: string;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  async function loadInvoices() {
    const { data } = await supabase.from("invoices").select("*");
    setInvoices(data || []);
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  async function generatePDF(invoice: Invoice) {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("ABA AI Invoice", 20, 20);

    doc.setFontSize(12);
    doc.text(`Invoice #: ${invoice.invoice_number}`, 20, 30);
    doc.text(`Status: ${invoice.status}`, 20, 40);
    doc.text(`Total: $${invoice.total_amount}`, 20, 50);

    doc.save(`invoice-${invoice.invoice_number}.pdf`);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Invoices</h1>

      <table border={1} cellPadding={10} style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Total</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.invoice_number}</td>
              <td>${inv.total_amount}</td>
              <td>{inv.status}</td>
              <td>
                <button onClick={() => generatePDF(inv)}>
                  Download PDF
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}