import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { requireApiKey, resolveConfig } from "../config";

async function fetchApi(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const config = await resolveConfig();
  const apiKey = await requireApiKey();
  const baseUrl = config.registryUrl.replace(/\/api\/skills\/?$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

export interface NotebookUploadOptions {
  org?: string;
  visibility?: string;
  description?: string;
}

export async function notebookUpload(
  filePath: string,
  options: NotebookUploadOptions,
) {
  const absPath = resolve(filePath);
  const content = readFileSync(absPath, "utf-8");
  const name = basename(filePath).replace(/\.anyt\.md$|\.anyt$|\.md$/, "");

  const body = {
    name,
    content,
    description: options.description,
    visibility: options.visibility || "private",
  };

  const path = options.org
    ? `/api/notebooks/org/${options.org}`
    : "/api/notebooks";

  const response = await fetchApi(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ||
        `Upload failed (${response.status})`,
    );
  }

  const notebook = (await response.json()) as {
    id: string;
    name: string;
    slug: string;
  };
  console.log(
    `Uploaded: ${notebook.name} (${notebook.id})${options.org ? ` to org ${options.org}` : ""}`,
  );
}

export interface NotebookListOptions {
  org?: string;
}

export async function notebookList(options: NotebookListOptions) {
  const path = options.org
    ? `/api/notebooks/org/${options.org}`
    : "/api/notebooks/-/mine";

  const response = await fetchApi(path);
  if (!response.ok) {
    throw new Error(`Failed to list notebooks (${response.status})`);
  }

  const notebooks = (await response.json()) as Array<{
    id: string;
    name: string;
    cellCount: number;
    visibility: string;
    updatedAt: string;
  }>;

  if (notebooks.length === 0) {
    console.log("No notebooks found");
    return;
  }

  console.log(
    `\n${"Name".padEnd(30)} ${"Cells".padEnd(8)} ${"Visibility".padEnd(12)} ${"Updated".padEnd(12)} ID`,
  );
  console.log("-".repeat(90));
  for (const nb of notebooks) {
    const updated = new Date(nb.updatedAt).toLocaleDateString();
    console.log(
      `${nb.name.slice(0, 28).padEnd(30)} ${String(nb.cellCount).padEnd(8)} ${nb.visibility.padEnd(12)} ${updated.padEnd(12)} ${nb.id}`,
    );
  }
  console.log(`\n${notebooks.length} notebook(s)`);
}

export async function notebookDownload(id: string, output?: string) {
  const response = await fetchApi(`/api/notebooks/${id}`);
  if (!response.ok) {
    throw new Error(`Notebook not found (${response.status})`);
  }

  const notebook = (await response.json()) as {
    name: string;
    slug: string;
    content: string;
  };
  const outPath = output || `${notebook.slug}.anyt.md`;
  writeFileSync(outPath, notebook.content, "utf-8");
  console.log(`Downloaded: ${notebook.name} -> ${outPath}`);
}

export async function notebookDelete(id: string) {
  const response = await fetchApi(`/api/notebooks/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete notebook (${response.status})`);
  }
  console.log(`Notebook ${id} deleted`);
}
