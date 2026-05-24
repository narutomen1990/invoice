import { notFound } from "next/navigation";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getWithholdingById, type WhtDetail } from "@/lib/queries/withholding";
import { getSignaturesAction } from "@/app/settings/actions";
import { formatMoney, bahtText } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";
import { PrintActions } from "./print-actions";

export const dynamic = "force-dynamic";

async function loadImageBase64(p: string | null | undefined): Promise<string | null> {
  if (!p) return null;
  try {
    const lp = p.startsWith("/") ? path.join(process.cwd(), "public", p) : p;
    const buf = await fs.readFile(lp);
    const ext = path.extname(lp).slice(1).toLowerCase();
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "gif"
          ? "image/gif"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// แบบ ภ.ง.ด. ตามลำดับในฟอร์มราชการ
const FORM_OPTS: { no: string; value: string; label: string }[] = [
  { no: "1", value: "pnd1a", label: "ภ.ง.ด.1ก" },
  { no: "2", value: "pnd1a_special", label: "ภ.ง.ด.1ก พิเศษ" },
  { no: "3", value: "pnd2", label: "ภ.ง.ด.2" },
  { no: "4", value: "pnd3", label: "ภ.ง.ด.3" },
  { no: "5", value: "pnd2a", label: "ภ.ง.ด.2ก" },
  { no: "6", value: "pnd3a", label: "ภ.ง.ด.3ก" },
  { no: "7", value: "pnd53", label: "ภ.ง.ด.53" },
];

const CONDITIONS: { no: string; value: string; label: string }[] = [
  { no: "1", value: "withhold", label: "หัก ณ ที่จ่าย" },
  { no: "2", value: "pay_always", label: "ออกให้ตลอดไป" },
  { no: "3", value: "pay_once", label: "ออกให้ครั้งเดียว" },
  { no: "4", value: "other", label: "อื่น ๆ (ระบุ)" },
];

type RowAgg = { date: string; amount: number; tax: number };

function aggregate(wht: WhtDetail): Record<string, RowAgg> {
  const map: Record<string, RowAgg> = {};
  for (const it of wht.items) {
    const a = map[it.category] ?? { date: "", amount: 0, tax: 0 };
    a.amount += it.amount;
    a.tax += it.tax;
    if (!a.date && it.datePaid) a.date = it.datePaid;
    map[it.category] = a;
  }
  return map;
}

function TaxIdBoxes({ value }: { value: string | null }) {
  const digits = (value ?? "").replace(/\D/g, "").padEnd(13, " ").slice(0, 13);
  return (
    <span className="taxid">
      {digits.split("").map((d, i) => (
        <span key={i} className="tbox">
          {d.trim()}
        </span>
      ))}
    </span>
  );
}

/** หนึ่งแถวของตารางประเภทเงินได้ */
function IncomeRow({
  label,
  agg,
  indent,
}: {
  label: React.ReactNode;
  agg?: RowAgg;
  indent?: number;
}) {
  return (
    <tr>
      <td className="inc-desc" style={indent ? { paddingLeft: `${indent}mm` } : undefined}>
        {label}
      </td>
      <td className="inc-date">{agg?.date ? formatThaiDateShort(agg.date) : ""}</td>
      <td className="inc-amt">{agg && agg.amount ? formatMoney(agg.amount) : ""}</td>
      <td className="inc-amt">{agg && agg.tax ? formatMoney(agg.tax) : ""}</td>
    </tr>
  );
}

const COPY_TEXTS: Record<1 | 2 | 3 | 4, string> = {
  1: "ฉบับที่ 1 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี)",
  2: "ฉบับที่ 2 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน)",
  3: "ฉบับที่ 3 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบแสดงรายการภาษี)",
  4: "ฉบับที่ 4 (สำเนาติดเล่ม สำหรับผู้หักภาษี ณ ที่จ่ายเก็บไว้เป็นหลักฐาน)",
};

function Copy({
  wht,
  copyNo,
  stampUrl,
}: {
  wht: WhtDetail;
  copyNo: 1 | 2 | 3 | 4;
  stampUrl: string | null;
}) {
  const agg = aggregate(wht);
  const alphaTax = wht.totalTaxWords?.trim() || bahtText(wht.totalTax);
  const copyText = COPY_TEXTS[copyNo];

  return (
    <div className="copy">
      <div className="copy-tag">{copyText}</div>

      {/* TITLE */}
      <div className="head">
        <div className="head-title">
          <div className="t1">หนังสือรับรองการหักภาษี ณ ที่จ่าย</div>
          <div className="t2">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
        </div>
        <div className="head-no">
          <div>เล่มที่ {wht.volumeNo || "............"}</div>
          <div>เลขที่ {wht.docNo}</div>
        </div>
      </div>

      {/* PAYER */}
      <div className="party">
        <div className="party-top">
          <span className="party-label">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย : -</span>
          <span className="taxid-wrap">
            เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*
            <TaxIdBoxes value={wht.payerTaxId} />
          </span>
        </div>
        <div className="party-name">
          ชื่อ <strong>{wht.payerName}</strong>
        </div>
        <div className="hint">
          (ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)
        </div>
        <div className="party-addr">ที่อยู่ {wht.payerAddress ?? ""}</div>
        <div className="hint">
          (ให้ระบุชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่
          ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)
        </div>
      </div>

      {/* PAYEE */}
      <div className="party">
        <div className="party-top">
          <span className="party-label">ผู้ถูกหักภาษี ณ ที่จ่าย : -</span>
          <span className="taxid-wrap">
            เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*
            <TaxIdBoxes value={wht.payeeTaxId} />
          </span>
        </div>
        <div className="party-name">
          ชื่อ <strong>{wht.payeeName}</strong>
        </div>
        <div className="hint">
          (ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)
        </div>
        <div className="party-addr">ที่อยู่ {wht.payeeAddress ?? ""}</div>
        <div className="hint">
          (ให้ระบุชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่
          ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)
        </div>
      </div>

      {/* ลำดับที่ + แบบ ภ.ง.ด. */}
      <div className="forms">
        <div className="forms-left">
          <div className="seq">
            ลำดับที่ {wht.sequenceInForm || "........."} ในแบบ
          </div>
          <div className="forms-hint">
            (ให้สามารถอ้างอิงหรือสอบยันกันได้ระหว่างลำดับที่ตามหนังสือรับรองฯ
            กับแบบยื่นรายการภาษีหักที่จ่าย)
          </div>
        </div>
        <div className="form-grid">
          {FORM_OPTS.map((f) => (
            <span key={f.value} className="fopt">
              <span className="cbx">
                {wht.formType === f.value ? "✓" : ""}
              </span>
              ({f.no}) {f.label}
            </span>
          ))}
        </div>
      </div>

      {/* INCOME TABLE */}
      <table className="inc">
        <thead>
          <tr>
            <th>ประเภทเงินได้พึงประเมินที่จ่าย</th>
            <th className="inc-date">วัน เดือน<br />หรือปีภาษี ที่จ่าย</th>
            <th className="inc-amt">จำนวนเงินที่จ่าย</th>
            <th className="inc-amt">ภาษีที่หัก<br />และนำส่งไว้</th>
          </tr>
        </thead>
        <tbody>
          <IncomeRow
            label="1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)"
            agg={agg["40_1"]}
          />
          <IncomeRow
            label="2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)"
            agg={agg["40_2"]}
          />
          <IncomeRow
            label="3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)"
            agg={agg["40_3"]}
          />
          <IncomeRow
            label="4. (ก) ดอกเบี้ย ฯลฯ ตามมาตรา 40 (4) (ก)"
            agg={agg["40_4a"]}
          />
          <IncomeRow
            label="(ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40 (4) (ข)"
            agg={agg["40_4b"]}
            indent={3}
          />
          <IncomeRow
            label="(1) กรณีผู้ได้รับเงินปันผลได้รับเครดิตภาษี โดยจ่ายจากกำไรสุทธิของกิจการที่ต้องเสียภาษีเงินได้นิติบุคคลในอัตราดังนี้"
            indent={6}
          />
          <IncomeRow label="(1.1) อัตราร้อยละ 30 ของกำไรสุทธิ" indent={9} />
          <IncomeRow label="(1.2) อัตราร้อยละ 25 ของกำไรสุทธิ" indent={9} />
          <IncomeRow label="(1.3) อัตราร้อยละ 20 ของกำไรสุทธิ" indent={9} />
          <IncomeRow
            label="(1.4) อัตราอื่น ๆ (ระบุ) ............ ของกำไรสุทธิ"
            indent={9}
          />
          <IncomeRow
            label="(2) กรณีผู้ได้รับเงินปันผลไม่ได้รับเครดิตภาษี เนื่องจากจ่ายจาก"
            indent={6}
          />
          <IncomeRow
            label="(2.1) กำไรสุทธิของกิจการที่ได้รับยกเว้นภาษีเงินได้นิติบุคคล"
            indent={9}
          />
          <IncomeRow
            label="(2.2) เงินปันผลหรือเงินส่วนแบ่งของกำไรที่ได้รับยกเว้นไม่ต้องนำมารวมคำนวณเป็นรายได้เพื่อเสียภาษีเงินได้นิติบุคคล"
            indent={9}
          />
          <IncomeRow
            label="(2.3) กำไรสุทธิส่วนที่ได้หักผลขาดทุนสุทธิยกมาไม่เกิน 5 ปี ก่อนรอบระยะเวลาบัญชีปัจจุบัน"
            indent={9}
          />
          <IncomeRow
            label="(2.4) กำไรที่รับรู้ทางบัญชีโดยวิธีส่วนได้เสีย (equity method)"
            indent={9}
          />
          <IncomeRow label="(2.5) อื่น ๆ (ระบุ) ............" indent={9} />
          <IncomeRow
            label="5. การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตามมาตรา 3 เตรส เช่น ค่าจ้างทำของ ค่าโฆษณา ค่าเช่า ค่าขนส่ง ค่าบริการ ค่าเบี้ยประกันวินาศภัย ฯลฯ"
            agg={agg["sec3tres"]}
          />
          <IncomeRow label="6. อื่น ๆ (ระบุ) ............" agg={agg["other"]} />
        </tbody>
        <tfoot>
          <tr>
            <td className="inc-total" colSpan={2}>
              รวมเงินที่จ่าย และ ภาษีที่นำส่ง
            </td>
            <td className="inc-amt b">{formatMoney(wht.totalPaid)}</td>
            <td className="inc-amt b">{formatMoney(wht.totalTax)}</td>
          </tr>
        </tfoot>
      </table>

      {/* แถวตัวอักษร — ป้ายแคบ + กล่องคำกว้าง */}
      <div className="words-row">
        <span className="words-label">รวมเงินภาษีที่นำส่ง (ตัวอักษร)</span>
        <span className="words-box">-- {alphaTax} --</span>
      </div>

      {/* กองทุน */}
      <div className="funds-box">
        <div className="funds-line">
          <span>
            เงินสะสมจ่ายเข้ากองทุนสำรองเลี้ยงชีพ ใบอนุญาตเลขที่{" "}
            {wht.pensionFundLicense || "........................"}
          </span>
          <span className="funds-amt">
            จำนวนเงิน
            <span className="blank-lg">
              {wht.pensionFund ? formatMoney(wht.pensionFund) : ""}
            </span>
            บาท
          </span>
        </div>
        <div className="funds-amt">
          เงินสมทบจ่ายเข้ากองทุนประกันสังคม จำนวน
          <span className="blank-lg">
            {wht.socialSecurity ? formatMoney(wht.socialSecurity) : ""}
          </span>
          บาท
        </div>
        <div>
          เลขที่บัญชีนายจ้าง{" "}
          {wht.employerAccountNo ? (
            <strong>{wht.employerAccountNo}</strong>
          ) : (
            <span className="blank-30">&nbsp;</span>
          )}{" "}
          เลขที่บัตรประกันสังคม ของผู้ถูกหักภาษี ณ ที่จ่าย
        </div>
      </div>

      {/* ผู้จ่ายเงิน | รับรอง+ลงนาม | ประทับตรา */}
      <div className="foot-row">
        <div className="foot-cond">
          <div className="cond-label">ผู้จ่ายเงิน</div>
          {CONDITIONS.map((c) => (
            <div key={c.value} className="cond-opt">
              <span className="cbx">
                {wht.taxCondition === c.value ? "✓" : ""}
              </span>
              ({c.no}) {c.label}
              {c.value === "other" && wht.taxCondition === "other"
                ? ` ${wht.taxConditionOther ?? ""}`
                : ""}
            </div>
          ))}
        </div>

        <div className="foot-certify">
          <div className="certify-txt">
            ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้น
            ถูกต้องตรงกับความจริงทุกประการ
          </div>
          <div className="sign-line">
            ลงชื่อ ...................................................
            ผู้มีหน้าที่หักภาษี ณ ที่จ่าย
          </div>
          <div className="sign-date">
            ........./........./.........{" "}
            <span className="sign-hint">
              (วัน เดือน ปี ที่ออกหนังสือรับรองฯ)
            </span>
          </div>
          <div className="sign-issued">
            วันที่ออกหนังสือ {formatThaiDateShort(wht.issueDate)}
          </div>
        </div>

        <div className="foot-stamp">
          <div className="stamp">
            <span className="stamp-cap">
              ประทับตรา<br />นิติบุคคล<br />(ถ้ามี)
            </span>
            {stampUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={stampUrl} alt="ตราประทับ" className="stamp-img" />
            )}
          </div>
        </div>
      </div>

      {/* คำเตือน + หมายเหตุ */}
      <div className="foot-notes">
        <div className="warn">
          <strong>คำเตือน</strong>{" "}
          ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย
          ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
          ต้องรับโทษทางอาญา ตามมาตรา 35 แห่งประมวลรัษฎากร
        </div>
        <div className="remark">
          <div className="remark-head">
            <strong>หมายเหตุ</strong> เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*
            หมายถึง
          </div>
          <div className="remark-item">
            1. กรณีบุคคลธรรมดาไทย
            ให้ใช้เลขประจำตัวประชาชนของกรมการปกครอง
          </div>
          <div className="remark-item">
            2. กรณีนิติบุคคล
            ให้ใช้เลขทะเบียนนิติบุคคลของกรมพัฒนาธุรกิจการค้า
          </div>
          <div className="remark-item">
            3. กรณีอื่น ๆ นอกเหนือจาก 1. และ 2.
            ให้ใช้เลขประจำตัวผู้เสียภาษีอากร (13 หลัก) ของกรมสรรพากร
          </div>
        </div>
      </div>
      {wht.note && <div className="note">หมายเหตุเพิ่มเติม : {wht.note}</div>}
    </div>
  );
}

export default async function WhtPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();
  const wht = await getWithholdingById(numId);
  if (!wht) notFound();

  // โหลดตราประทับจาก settings ถ้าเอกสารนี้เปิดใช้
  let stampUrl: string | null = null;
  if (wht.stampEnabled) {
    const sigs = await getSignaturesAction();
    stampUrl = await loadImageBase64(sigs.stamp.path);
  }

  // ?copies=12 → แค่ฉบับ 1+2 / =34 → แค่ฉบับ 3+4 / ไม่ใส่ → ทั้ง 4 ฉบับ (2 แผ่น)
  const copiesParam = sp.copies;
  type Pair = [1 | 2 | 3 | 4, 1 | 2 | 3 | 4];
  const sheets: Pair[] =
    copiesParam === "12"
      ? [[1, 2]]
      : copiesParam === "34"
        ? [[3, 4]]
        : [
            [1, 2],
            [3, 4],
          ];

  return (
    <>
      <PrintActions docNo={wht.docNo} id={wht.id} />
      {sheets.map(([a, b], idx) => (
        <div className="sheet" key={idx}>
          <Copy wht={wht} copyNo={a} stampUrl={stampUrl} />
          <Copy wht={wht} copyNo={b} stampUrl={stampUrl} />
        </div>
      ))}

      <style>{`
        :root { color-scheme: light; }
        body { margin: 0; background: #e5e5e5; }
        .sheet {
          display: flex;
          width: 297mm;
          min-height: 210mm;
          margin: 1rem auto;
          background: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .copy {
          width: 148.5mm;
          min-height: 210mm;
          /* ขอบบน-ล่าง 8mm กันเครื่องพิมพ์ตัดขอบ */
          padding: 8mm 7mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          font-family: "Sarabun", "Noto Sans Thai", sans-serif;
          font-size: 7.3px;
          color: #000;
          line-height: 1.4;
        }
        .copy:first-child { border-right: 1px dashed #999; }

        .copy-tag { font-size: 6.5px; margin-bottom: 1.5mm; }

        .head {
          display: flex; justify-content: space-between;
          align-items: flex-start; margin-bottom: 1mm;
        }
        .head-title { flex: 1; text-align: center; }
        .t1 { font-size: 13px; font-weight: 700; }
        .t2 { font-size: 9px; }
        .head-no { font-size: 7.5px; text-align: right; white-space: nowrap; }
        .head-no div:last-child { font-family: monospace; color: #c00; }

        .party {
          border: 1px solid #000;
          padding: 1mm 2mm;
          margin-bottom: 1mm;
        }
        .party-top {
          display: flex; justify-content: space-between;
          align-items: center; gap: 2mm;
        }
        .party-label { font-weight: 700; font-size: 8.5px; }
        .taxid-wrap {
          display: inline-flex; align-items: center; gap: 1mm;
          font-size: 6.5px; white-space: nowrap;
        }
        .party-name { font-size: 9px; margin-top: 0.5mm; }
        .party-addr { font-size: 7.8px; margin-top: 0.5mm; min-height: 3.5mm; }
        .hint { font-size: 6px; color: #555; font-style: italic; }
        .hint-c { text-align: center; margin: 0.4mm 0; }

        .taxid { display: inline-flex; gap: 0.6px; }
        .tbox {
          display: inline-flex; align-items: center; justify-content: center;
          width: 2.9mm; height: 3.2mm;
          border: 1px solid #000; font-size: 6.5px; font-family: monospace;
        }

        .forms {
          display: flex; align-items: flex-start; gap: 6mm;
          margin-top: 1mm;
        }
        .forms-left { width: 50mm; flex-shrink: 0; }
        .seq { font-weight: 700; font-size: 8px; white-space: nowrap; }
        .forms-hint {
          font-size: 6px; color: #555; font-style: italic;
          line-height: 1.35; margin-top: 0.8mm;
        }
        /* 7 แบบ ภ.ง.ด. — 4 คอลัมน์ = 2 บรรทัด (4 + 3) */
        .form-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5mm 2mm;
          font-size: 7px;
        }
        .fopt { display: inline-flex; align-items: center; gap: 0.8mm; }
        .cbx {
          display: inline-flex; align-items: center; justify-content: center;
          width: 2.8mm; height: 2.8mm; border: 1px solid #000;
          font-size: 7px; font-weight: 700;
        }

        .inc { width: 100%; border-collapse: collapse; margin-top: 1.5mm; }
        .inc th, .inc td {
          border: 1px solid #000; padding: 0.4mm 1mm;
          font-size: 7px; vertical-align: top;
        }
        .inc th {
          background: #eee; text-align: center; font-weight: 700;
          line-height: 1.2;
        }
        .inc .inc-date { width: 17mm; text-align: center; }
        .inc .inc-amt { width: 16mm; text-align: right; }
        /* ในตาราง — ไม่มีเส้นขั้นแนวนอนระหว่างแถว (คอลัมน์เปิดต่อเนื่อง)
           เหลือแค่เส้นกรอบนอก + เส้นแบ่งคอลัมน์ตั้ง */
        .inc tbody td {
          border-top: none;
          border-bottom: none;
        }
        .inc-desc { line-height: 1.15; }
        /* แถวรวม — ป้ายชิดขวา ตัวหนา เว้นช่องสูง */
        .inc-total {
          text-align: right; font-weight: 700;
          font-size: 7px; padding: 0.6mm 1.5mm;
        }
        .inc tfoot .inc-amt { padding: 0.6mm 1mm; font-size: 7.5px; }
        .inc .b { font-weight: 700; }

        /* แถวตัวอักษร — ป้ายแคบ + กล่องคำกว้าง */
        .words-row {
          display: flex;
          border: 1px solid #000;
          border-top: none;
        }
        .words-label {
          padding: 1.2mm 1.5mm;
          font-size: 6.8px;
          white-space: nowrap;
          border-right: 1px solid #000;
          display: flex; align-items: center;
        }
        .words-box {
          flex: 1;
          text-align: center; font-weight: 700; font-size: 8.5px;
          padding: 1.2mm 1mm;
          display: flex; align-items: center; justify-content: center;
        }

        /* กล่องกองทุน */
        .funds-box {
          border: 1px solid #000;
          border-top: none;
          padding: 1.2mm 2mm;
          font-size: 6.8px;
          line-height: 1.55;
        }
        .funds-line {
          display: flex; justify-content: space-between; gap: 3mm;
        }
        .funds-amt {
          display: inline-flex; align-items: baseline; gap: 1mm;
          white-space: nowrap;
        }
        /* ช่องกรอกตัวเลข — เส้นประยาว */
        .blank-lg {
          display: inline-block;
          min-width: 20mm;
          border-bottom: 1px dotted #000;
          text-align: center;
        }
        .blank-30 {
          display: inline-block;
          min-width: 30mm;
          border-bottom: 1px dotted #000;
        }

        /* แถวล่าง: ผู้จ่ายเงิน | รับรอง | ตรา */
        .foot-row {
          display: flex;
          border: 1px solid #000;
          border-top: none;
        }
        .foot-cond {
          width: 40mm;
          border-right: 1px solid #000;
          padding: 1.8mm 2mm;
          font-size: 7px;
        }
        .cond-label { font-weight: 700; margin-bottom: 1.2mm; }
        .cond-opt {
          display: flex; align-items: center; gap: 1mm;
          margin-bottom: 0.8mm;
        }
        .foot-certify {
          flex: 1;
          padding: 2mm 2.5mm;
          text-align: center;
        }
        .certify-txt { font-size: 7px; }
        .foot-stamp {
          width: 28mm;
          border-left: 1px solid #000;
          display: flex; align-items: center; justify-content: center;
          padding: 1mm;
        }
        .sign-line { font-size: 7.5px; margin-top: 4mm; }
        .sign-date { font-size: 7px; margin-top: 1mm; }
        .sign-hint { font-size: 6px; color: #555; }
        .sign-issued { font-size: 7px; margin-top: 1mm; color: #333; }

        /* คำเตือน + หมายเหตุ */
        .foot-notes {
          display: flex; gap: 3mm;
          margin-top: auto; padding-top: 1.5mm;
          font-size: 6.3px;
          line-height: 1.3; color: #333;
        }
        .warn { width: 34%; }
        .remark { flex: 1; }
        .remark-head { margin-bottom: 0.3mm; }
        /* แต่ละข้อขึ้นบรรทัดใหม่ + ย่อหน้าแขวน เลขข้อตรงกัน */
        .remark-item {
          padding-left: 4mm;
          text-indent: -4mm;
        }
        .foot-notes strong { color: #000; }

        .stamp {
          position: relative;
          width: 16mm; height: 16mm;
          border: 1px dashed #999; border-radius: 50%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          font-size: 5.5px; color: #999; text-align: center;
        }
        .stamp-cap { position: relative; z-index: 0; }
        /* แสดงตราประทับเต็มรูป ทับวงกลม ไม่ตัดตามวงกลม */
        .stamp-img {
          position: absolute;
          left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          width: 24mm; height: 24mm;
          object-fit: contain;
          z-index: 1;
        }
        .note { font-size: 6px; margin-top: 1mm; color: #444; }

        @media print {
          body { background: #fff; }
          /* zoom จากหน้าจอต้องไม่กระทบการพิมพ์จริง */
          .sheet { margin: 0; box-shadow: none; transform: none !important; }
          /* แต่ละ .sheet = หนึ่งหน้ากระดาษ A4 (ใบที่ 2 ขึ้นหน้าใหม่) */
          .sheet + .sheet { page-break-before: always; }
          @page { size: A4 landscape; margin: 0; }
        }
      `}</style>
    </>
  );
}
