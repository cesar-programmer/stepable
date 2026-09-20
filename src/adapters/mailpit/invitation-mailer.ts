import type { InvitationMailer } from "../../modules/invitations/contract.ts";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

export class MailpitInvitationMailer implements InvitationMailer {
  constructor(private readonly baseUrl: string) {}

  async sendInvitation(input: {
    recipient: string;
    spaceName: string;
    role: "responsable" | "integrante";
    acceptUrl: string;
  }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: "noreply@stepable.local", Name: "Stepable local" },
        To: [{ Email: input.recipient }],
        Subject: `Invitación a ${input.spaceName}`,
        Text: [
          `Te invitaron a ${input.spaceName} con el rol ${input.role}.`,
          "Abre el enlace y acepta la invitación explícitamente:",
          input.acceptUrl,
        ].join("\n\n"),
        HTML: `<p>Te invitaron a <strong>${escapeHtml(input.spaceName)}</strong> con el rol <strong>${input.role}</strong>.</p><p><a href="${escapeHtml(input.acceptUrl)}">Revisar invitación</a></p><p>La membresía se crea únicamente cuando aceptas explícitamente en Stepable.</p>`,
        Tags: ["stepable-invitation"],
      }),
    });

    if (!response.ok) {
      throw new Error(`Mailpit rejected the message (${response.status}).`);
    }
  }
}
