import type { InvoiceDetail } from "@/lib/queries/invoices";

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function num(v: number, digits = 2): string {
  return Number.isFinite(v) ? v.toFixed(digits) : (0).toFixed(digits);
}

function isoDate(s: string | null | undefined): string {
  if (!s) return new Date().toISOString().slice(0, 10);
  // accept "YYYY-MM-DD" or full ISO
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * Build an ETDA e-Tax Invoice XML (UBL 2.1) for a tax-invoice document.
 * Document Type Code 388 = Tax Invoice / 380 = Commercial Invoice.
 * Note: digital signature (XAdES-T) must be applied externally with a
 * CA-issued certificate before submission to RD.
 */
export function buildEtaxInvoiceXml(d: InvoiceDetail): string {
  const issueDate = isoDate(d.doc.docDate);
  const dueDate = d.doc.dueDate ? isoDate(d.doc.dueDate) : "";
  const sellerTaxId = (d.company.taxId || "").replace(/[^0-9]/g, "");
  const buyerTaxId = (d.doc.customerTaxId || "").replace(/[^0-9]/g, "");
  const sellerBranch = "00000";
  const buyerBranch = (d.doc.customerBranch || "00000").padStart(5, "0").slice(-5);

  const lineXml = d.items
    .map((it) => {
      const lineExt = num(it.amount, 2);
      const qty = num(it.quantity, 4);
      const price = num(it.unitPrice, 4);
      return `    <cac:InvoiceLine>
      <cbc:ID>${esc(it.lineNo)}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${esc(it.unit || "EA")}">${qty}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="THB">${lineExt}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Description>${esc(it.description || "")}</cbc:Description>
        ${it.productCode ? `<cac:SellersItemIdentification><cbc:ID>${esc(it.productCode)}</cbc:ID></cac:SellersItemIdentification>` : ""}
        <cac:ClassifiedTaxCategory>
          <cbc:ID>VAT</cbc:ID>
          <cbc:Percent>${num(d.doc.vatRate, 2)}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="THB">${price}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:etda:ubl:th:2017</cbc:CustomizationID>
  <cbc:ProfileID>ETDA-eTaxInvoice-3.0</cbc:ProfileID>
  <cbc:ID>${esc(d.doc.docNo)}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  ${dueDate ? `<cbc:DueDate>${dueDate}</cbc:DueDate>` : ""}
  <cbc:InvoiceTypeCode listAgencyID="6" listID="UN/ECE 1001">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>THB</cbc:DocumentCurrencyCode>
  ${d.doc.referenceQuotationNo ? `<cac:OrderReference><cbc:ID>${esc(d.doc.referenceQuotationNo)}</cbc:ID></cac:OrderReference>` : ""}

  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="TXID">${esc(sellerTaxId)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyIdentification>
        <cbc:ID schemeID="BRN">${sellerBranch}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${esc(d.company.nameTh)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(d.company.addressTh || "")}</cbc:StreetName>
        <cac:Country><cbc:IdentificationCode>TH</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${d.company.tel ? `<cac:Contact><cbc:Telephone>${esc(d.company.tel)}</cbc:Telephone></cac:Contact>` : ""}
    </cac:Party>
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    <cac:Party>
      ${
        buyerTaxId
          ? `<cac:PartyIdentification><cbc:ID schemeID="TXID">${esc(buyerTaxId)}</cbc:ID></cac:PartyIdentification>
      <cac:PartyIdentification><cbc:ID schemeID="BRN">${buyerBranch}</cbc:ID></cac:PartyIdentification>`
          : ""
      }
      <cac:PartyName><cbc:Name>${esc(d.doc.customerName || "")}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(d.doc.customerAddress || "")}</cbc:StreetName>
        ${d.doc.customerProvince ? `<cbc:CountrySubentity>${esc(d.doc.customerProvince)}</cbc:CountrySubentity>` : ""}
        <cac:Country><cbc:IdentificationCode>TH</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${d.doc.customerTel ? `<cac:Contact><cbc:Telephone>${esc(d.doc.customerTel)}</cbc:Telephone></cac:Contact>` : ""}
    </cac:Party>
  </cac:AccountingCustomerParty>

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="THB">${num(d.doc.vatAmount)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="THB">${num(d.doc.amountBeforeVat)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="THB">${num(d.doc.vatAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>VAT</cbc:ID>
        <cbc:Percent>${num(d.doc.vatRate, 2)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="THB">${num(d.doc.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="THB">${num(d.doc.amountBeforeVat)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="THB">${num(d.doc.total)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="THB">${num(d.doc.discount)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="THB">${num(d.doc.netTotal)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

${lineXml}
</Invoice>
`;
}
