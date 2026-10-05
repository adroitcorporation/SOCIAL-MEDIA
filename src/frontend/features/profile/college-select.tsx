'use client';
import { useEffect, useState } from 'react';
import { useCircle } from '@/frontend/state/circle-context';
import type { CollegeOption } from '@/shared/contracts/recommendations';
export function CollegeSelect({value,onChange,onBlur,error}:{value:string;onChange:(value:string)=>void;onBlur:()=>void;error?:string}) {
  const {api}=useCircle();const [options,setOptions]=useState<CollegeOption[]>([]);const [focused,setFocused]=useState(false);const [active,setActive]=useState(-1);
  useEffect(()=>{if(!focused)return;let current=true;const timer=setTimeout(()=>{api.colleges(value).then(v=>{if(current){setOptions(v);setActive(-1);}}).catch(()=>{if(current)setOptions([]);});},200);return()=>{current=false;clearTimeout(timer);};},[api,value,focused]);
  const choose=(option:CollegeOption)=>{onChange(option.name);setFocused(false);};
  return <div className="college-select"><label htmlFor="profile-college">College (required)</label>
    <input id="profile-college" name="college" role="combobox" aria-autocomplete="list" aria-expanded={focused&&options.length>0} aria-controls="college-options" aria-activedescendant={active>=0?`college-option-${active}`:undefined} value={value} maxLength={150} required autoComplete="off" placeholder="Search college or abbreviation" onFocus={()=>setFocused(true)} onBlur={()=>{setFocused(false);onBlur();}} onChange={e=>{onChange(e.target.value);setFocused(true);}} aria-invalid={Boolean(error)} aria-describedby={error?'profile-college-error':undefined} onKeyDown={e=>{
      if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>Math.min(i+1,options.length-1));}
      if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(i-1,0));}
      if(e.key==='Escape')setFocused(false);
      if(e.key==='Enter'&&focused&&options[active]){e.preventDefault();choose(options[active]);}
    }}/>
    {focused&&options.length>0&&<ul id="college-options" role="listbox">{options.map((o,i)=><li key={o.id} id={`college-option-${i}`} role="option" aria-selected={active===i} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(o)}><strong>{o.name}</strong><small>{o.city}, {o.state}</small></li>)}</ul>}
    {error&&<span id="profile-college-error" className="error">{error}</span>}
  </div>;
}
