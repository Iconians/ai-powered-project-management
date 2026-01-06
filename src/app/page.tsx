import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getCurrentUser();

  // If user is logged in, redirect to boards
  if (user) {
    redirect("/boards");
  }

  // Show landing page for non-authenticated users
  redirect("/home");
}
