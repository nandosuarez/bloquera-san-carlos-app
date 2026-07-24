import { NextRequest, NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import {
  createOperatingExpense,
  normalizeExpenseCategory,
  OperatingExpenseError,
  voidOperatingExpense
} from "@/lib/operating-expenses";
import { requireOperationsRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";

function redirectToModule(request: NextRequest, query: string) {
  return redirectTo(request, `/gastos?${query}`);
}

export async function POST(request: NextRequest) {
  const session = requireOperationsRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();
  const action = String(formData.get("action") ?? "create");

  try {
    if (action === "void") {
      const expenseId = String(formData.get("expenseId") ?? "");
      await voidOperatingExpense({
        expenseId,
        reason: String(formData.get("reason") ?? ""),
        recordedByUserId: session.userId
      });
      await recordAuditLog({
        action: "VOID",
        actor: session,
        entityId: expenseId,
        entityType: "operating_expense",
        summary: "Gasto operativo anulado"
      });

      return redirectToModule(request, "success=expense_voided");
    }

    const result = await createOperatingExpense({
      category: normalizeExpenseCategory(String(formData.get("category") ?? "")),
      concept: String(formData.get("concept") ?? "").trim(),
      expenseOn: String(formData.get("expenseOn") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim(),
      paymentMethod: String(formData.get("paymentMethod") ?? "").trim(),
      providerId: String(formData.get("providerId") ?? "").trim(),
      recordedByUserId: session.userId,
      totalAmount: parseNumber(formData.get("totalAmount"))
    });
    await recordAuditLog({
      action: "CREATE",
      actor: session,
      entityId: result.expenseId,
      entityType: "operating_expense",
      summary: "Gasto operativo creado"
    });

    return redirectToModule(request, "success=expense_saved");
  } catch (error) {
    console.error("Error saving operating expense", error);

    if (error instanceof OperatingExpenseError) {
      return redirectToModule(request, `error=${error.code}`);
    }

    return redirectToModule(request, "error=server_error");
  }
}

function parseNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
