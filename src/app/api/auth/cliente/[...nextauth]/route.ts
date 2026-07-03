import NextAuth from "next-auth";
import { authOptionsCliente } from "@/auth-cliente";

const handler = NextAuth(authOptionsCliente);
export { handler as GET, handler as POST };
