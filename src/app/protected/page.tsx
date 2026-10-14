import { redirect } from "next/navigation";

/**
 * Former landing page after signing in. Kept so old links keep working:
 * the list of spaces asks for a session itself.
 */
export default function ProtectedPage() {
  redirect("/spaces");
}
