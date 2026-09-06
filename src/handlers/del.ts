import { Env, err, json } from "../responses";
import { isAuthed } from "../auth";
import { FULL_EXTS, POOLS, fullKey, thumbKey } from "../ids";

export async function handleDelete(request: Request, env: Env, id: string): Promise<Response> {
  if (!isAuthed(request, env)) return err(401, "unauthorized");

  // The id is pool-agnostic (it survives promote), so sweep both pools' keys in
  // one call — at most 5 fulls + 1 thumb per pool.
  const keys: string[] = [];
  for (const pool of POOLS) {
    keys.push(...FULL_EXTS.map((ext) => fullKey(pool, id, ext)));
    keys.push(thumbKey(pool, id));
  }
  // R2 delete accepts an array of keys
  await env.BUCKET.delete(keys);

  return json({ deleted: true });
}
