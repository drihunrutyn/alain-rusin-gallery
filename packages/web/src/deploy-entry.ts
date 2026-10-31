import handler from "./server";
import "./telegram-digest";
import { deno } from "./api/lib/kv";
export default handler;
// Deploy dynamic runtime executes the entrypoint; export is also reusable by deno serve.
if (deno) deno.serve(handler.fetch);
