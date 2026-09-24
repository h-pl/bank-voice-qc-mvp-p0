"use client";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { SelectField } from "./select-field";
import { Button } from "./ui";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { resourceSchemas } from "../lib/strategy-schema";
import { resourceRows, serializeRows } from "../lib/resource-import";
export function ResourceRowsTable({kind,content,limit}:{kind:string;content:string;limit?:number}){
 const schema=resourceSchemas[kind]; const rows=resourceRows(kind,content);
 return <div className="structured-resource-table"><Table><TableHeader><TableRow>{schema.fields.map(f=><TableHead key={f}>{f}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0,limit ?? rows.length).map((row,i)=><TableRow key={i}>{schema.fields.map((f,col)=><TableCell key={f}>{row[col] || "—"}</TableCell>)}</TableRow>)}</TableBody></Table></div>;
}
export function StructuredResourceEditor({kind,content,onChange}:{kind:string;content:string;onChange:(text:string)=>void}){
 const schema=resourceSchemas[kind];let rows:string[][]=[];try{rows=content?resourceRows(kind,content):[];}catch{}
 const save=(next:string[][])=>onChange(serializeRows([schema.fields,...next]));
 const update=(index:number,col:number,value:string)=>save(rows.map((row,i)=>i===index?schema.fields.map((_,j)=>j===col?value:row[j] ?? ""):row));
 return <section className="structured-resource-editor" aria-label={`${schema.name}字段`}>
 <div className="resource-import-heading"><div><b>内容条目 · {rows.length} 条</b><p>* 为必填</p></div>{kind!=="emotion" && <Button onClick={()=>save([...rows,schema.fields.map((_,col)=>kind==="voice" && col===2 ? "启用" : "")])}>添加一条</Button>}</div>
 {schema.note && <p className="callout">{schema.note}</p>}
 {rows.map((row,index)=><section key={index} className="structured-record" aria-label={`第 ${index+1} 条`}><div className="structured-record-heading"><h4>第 {index+1} 条</h4>{kind!=="emotion" && <Button onClick={()=>save(rows.filter((_,i)=>i!==index))}>删除第 {index+1} 条</Button>}</div><div className="indicator-config-form">{schema.fields.map((field,col)=>{
  const options=kind==="voice"&&col===2?["启用","停用"]:kind==="emotion"&&col===0?["愤怒","焦虑","悲伤","平静"]:kind==="sop"&&col===3?["是","否"]:kind==="privacy"&&col===5?["全部遮蔽","仅显示后四位","不脱敏"]:undefined;
  const id=`resource-${kind}-${index}-${col}`;
  return <label key={field} htmlFor={id}>{field}{schema.required.includes(col)?" *":""}{kind==="voice"&&col===1?<><Input id={id} type="file" accept="audio/*" onChange={e=>{const file=e.target.files?.[0];if(file)update(index,col,file.name);}}/><small>{row[col] ? `已登记：${row[col]}；选择新文件可替换` : "请选择注册语音"}</small></>:options?<SelectField id={id} value={row[col] || ""} onValueChange={value=>update(index,col,value)}><option value="">请选择</option>{options.map(v=><option key={v} value={v}>{v}</option>)}</SelectField>:["定义","判定说明","知识内容","步骤内容","情绪描述"].includes(field)?<Textarea id={id} rows={2} value={row[col] ?? ""} onChange={e=>update(index,col,e.target.value)}/>:<Input id={id} type={field.endsWith("日期")?"date":field==="步骤序号"?"number":"text"} min={field==="步骤序号"?1:undefined} value={row[col] ?? ""} onChange={e=>update(index,col,e.target.value)}/>}</label>;
 })}</div></section>)}
 {!rows.length && <p className="subtle">{schema.csv ? "添加一条记录，或使用此资源的 CSV 模板导入。" : "添加一条记录，填写坐席/工号并选择注册语音。"}</p>}
 </section>;
}
