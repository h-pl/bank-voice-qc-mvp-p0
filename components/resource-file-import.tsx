"use client";
import { useEffect, useRef, useState } from "react";
import { ResourceRowsTable } from "./structured-resource";
import { resourceSchemas } from "../lib/strategy-schema";
import { parseSopRules } from "../lib/sop-rules";
import { Button } from "./ui/button";

import { Disclosure } from "./disclosure";
import { readResourceFile, resourceRows, serializeRows } from "../lib/resource-import";
export function ResourceFileImport({ type, current, onApply, onPending }: { type: string; current: string; onApply: (content: string, name: string) => void; onPending: (pending: boolean) => void }) {
  const schema=resourceSchemas[type];
  const [preview, setPreview] = useState<{name:string;content:string} | null>(null);
  const [loading, setLoading] = useState(false), [error,setError] = useState("");
  const request = useRef(0), picker = useRef<HTMLInputElement>(null);
  useEffect(() => () => { request.current++; }, []);
  const clear = () => { request.current++; setPreview(null); setLoading(false); setError(""); onPending(false); };
  const read = async (file?:File) => {
    if (!file) return;
    const token = ++request.current; setLoading(true); setPreview(null); setError(""); onPending(true);
    try { const content=await readResourceFile(file,type); if(token===request.current) setPreview({name:file.name,content}); }
    catch(e) { if(token===request.current) { setError(e instanceof Error ? e.message : "解析失败，请检查文件后重试。"); onPending(false); } }
    finally { if(token===request.current) setLoading(false); }
  };
  if(schema && !schema.csv)return null;
  return <section className="resource-file-import" aria-label="文件导入与更新">
    <div className="resource-import-heading"><div><b>从文件导入内容</b><p>适用于批量更新；少量修改可直接编辑下方正文。</p></div><Button type="button" variant="outline" onClick={()=>picker.current?.click()}>选择文件</Button></div>
    <input ref={picker} className="sr-only" type="file" aria-label="选择资源文件" accept=".csv" onChange={e=>{void read(e.target.files?.[0]);e.target.value="";}}/>
    <div className="resource-template"><a href={schema?`data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFF"+serializeRows([schema.fields,...schema.rows.slice(0,2)]))}`:`/templates/${type === "SOP" ? "sop" : type === "词库" ? "lexicon" : "knowledge"}-template.csv`} download={schema?`${schema.name}_v2.csv`:undefined}>下载{schema?.name ?? type} CSV 模板</a><p>{schema?`表头：${schema.fields.join("、")}`:"单列、无表头，每行一条内容"}</p></div>
    <small>UTF-8 CSV · 最大 5 MB · 预览前 5 行，校验并导入全部记录</small>
    {loading && <p role="status">正在解析文件… <Button type="button" variant="outline" onClick={clear}>取消解析</Button></p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {preview && <div className="resource-import-preview">
      <b>{preview.name}</b><p>共 {schema?resourceRows(type,preview.content).length:preview.content.split("\n").length} 条 · 仅预览前 5 行 · 全部记录已通过格式检查</p>
      {schema?<ResourceRowsTable kind={type} content={preview.content} limit={5}/>:<ol className="csv-preview-lines">{preview.content.split("\n").slice(0,5).map((line,i)=><li key={i}>{line}</li>)}</ol>}
      <Disclosure title={`对照原内容（${current.length.toLocaleString()} 字）`}><pre>{current || "尚无内容"}</pre></Disclosure>
      <div className="resource-import-actions"><Button type="button" variant="outline" onClick={clear}>取消导入</Button><Button type="button" variant="default" disabled={!preview.content.trim()} onClick={()=>{try {if(type === "SOP") parseSopRules(preview.content);onApply(preview.content.trim(),preview.name);clear();} catch(e) {setError(e instanceof Error ? e.message : "请检查格式");}}}>确认替换内容</Button></div>
    </div>}
  </section>;
}
