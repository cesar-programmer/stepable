import { createSupabaseIdentityGateway } from "@/adapters/supabase/identity-gateway";

import { InvitationClient } from "./invitation-client";

export default async function AcceptInvitationPage() {
  const identity = await createSupabaseIdentityGateway();
  const currentIdentity = await identity.currentIdentity();

  return (
    <main>
      <p className="eyebrow">Invitación de Stepable</p>
      <h1>Revisar invitación</h1>
      <p>Abrir este enlace no crea una membresía. Confirma para aceptarla.</p>
      <InvitationClient authenticatedEmail={currentIdentity?.email ?? null} />
    </main>
  );
}
