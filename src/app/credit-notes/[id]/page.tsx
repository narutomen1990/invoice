import { redirect } from "next/navigation";

/**
 * No standalone view page for credit notes — clicking a row jumps straight
 * to the edit form (matches what /credit-notes/[id] links expect).
 */
export default async function CreditNoteDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/credit-notes/${id}/edit`);
}
