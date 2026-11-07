import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactElement, ReactNode, SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

type Option={value:string;label:string;disabled:boolean;group?:string};
type Props=SelectHTMLAttributes<HTMLSelectElement>&{children:ReactNode};
type OptionProps={value?:string|number;label?:string;disabled?:boolean;children?:ReactNode};

function textOf(node:ReactNode):string{
 if(typeof node==='string'||typeof node==='number')return String(node);
 if(Array.isArray(node))return node.map(textOf).join('');
 if(isValidElement(node))return textOf((node.props as {children?:ReactNode}).children);
 return '';
}
function readOptions(children:ReactNode,group?:string):Option[]{
 return Children.toArray(children).flatMap(node=>{
  if(!isValidElement(node))return [];
  const element=node as ReactElement<OptionProps>;
  if(typeof element.type!=='string')return readOptions(element.props.children,group);
  if(element.type==='optgroup')return readOptions(element.props.children,element.props.label||group);
  if(element.type!=='option')return [];
  const label=element.props.label||textOf(element.props.children);
  return [{value:String(element.props.value??label),label,disabled:Boolean(element.props.disabled),group}];
 });
}
type Placement={left:number;top:number;width:number;maxHeight:number};
const emptyPosition:Placement={left:12,top:80,width:260,maxHeight:300};

/**
 * A shared, styled open dropdown on PC/tablet/phone.
 * Keep a real semantic select for forms, keyboard navigation, accessibility and existing code.
 * A pointer-only overlay intercepts native popup activation; the options are drawn in a portal,
 * outside all clipped tables/modals. The native onChange contract stays unchanged.
 */
export default function PolishedSelect({
 children,value,defaultValue,onChange,onKeyDown,disabled,className='',style,
 ...rest
}:Props){
 const options=readOptions(children);
 const initial=String(value??defaultValue??options[0]?.value??'');
 const [internal,setInternal]=useState(initial);
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState('');
 const [active,setActive]=useState(0);
 const [placement,setPlacement]=useState<Placement>(emptyPosition);
 const root=useRef<HTMLSpanElement>(null);
 const realSelect=useRef<HTMLSelectElement>(null);
 const popup=useRef<HTMLDivElement>(null);
 const search=useRef<HTMLInputElement>(null);
 const listId=useId();
 const chosen=String(value??internal);
 const current=options.find(x=>x.value===chosen);
 const shown=options.filter(x=>x.label.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
 const searchEnabled=options.length>=9;
 const title=String(rest['aria-label']||current?.label||'Выбрать');
 const updatePosition=()=>{
  if(!root.current)return;
  const rect=root.current.getBoundingClientRect();
  const viewportWidth=window.innerWidth,viewportHeight=window.innerHeight;
  const width=Math.min(Math.max(rect.width,Math.min(310,viewportWidth-24)),viewportWidth-16);
  const left=Math.max(8,Math.min(rect.left,viewportWidth-width-8));
  const below=Math.max(0,viewportHeight-rect.bottom-10);
  const above=Math.max(0,rect.top-10);
  const upward=below<190&&above>below;
  const available=Math.max(92,Math.min(345,(upward?above:below)-6));
  const top=upward?Math.max(8,rect.top-available-5):Math.min(viewportHeight-8,rect.bottom+5);
  setPlacement({left,top,width,maxHeight:available});
 };
 const show=()=>{
  if(disabled)return;
  setQuery('');
  const selected=options.findIndex(x=>x.value===chosen);
  setActive(selected>=0?selected:0);
  setOpen(true);
  realSelect.current?.focus();
 };
 const close=()=>{setOpen(false);setQuery('');setActive(0)};
 const choose=(next:Option)=>{
  if(next.disabled)return;
  setInternal(next.value);
  // All current consumers use event.target.value. Retain that established contract.
  if(onChange)onChange({target:{value:next.value},currentTarget:{value:next.value}} as ChangeEvent<HTMLSelectElement>);
  close();
  realSelect.current?.focus();
 };
 useLayoutEffect(()=>{if(open)updatePosition()},[open,query,options.length]);
 useEffect(()=>{
  if(!open)return;
  const onDown=(event:PointerEvent)=>{
   if(!root.current?.contains(event.target as Node)&&!popup.current?.contains(event.target as Node))close();
  };
  const onEscape=(event:globalThis.KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();close();realSelect.current?.focus()}
  };
  const onScroll=()=>updatePosition();
  document.addEventListener('pointerdown',onDown);
  document.addEventListener('keydown',onEscape);
  window.addEventListener('resize',onScroll);
  window.addEventListener('scroll',onScroll,true);
  return ()=>{
   document.removeEventListener('pointerdown',onDown);
   document.removeEventListener('keydown',onEscape);
   window.removeEventListener('resize',onScroll);
   window.removeEventListener('scroll',onScroll,true);
  };
 },[open]);
 const step=(direction:number)=>{
  if(!shown.length)return;
  setActive(old=>{
   let next=old;
   for(let i=0;i<shown.length;i++){
    next=(next+direction+shown.length)%shown.length;
    if(!shown[next].disabled)return next;
   }
   return old;
  });
 };
 const keys=(event:KeyboardEvent<HTMLElement>)=>{
  if(!open&&(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Enter'||event.key===' ')){
   event.preventDefault();show();return;
  }
  if(!open)return;
  if(event.key==='ArrowDown'){event.preventDefault();step(1)}
  else if(event.key==='ArrowUp'){event.preventDefault();step(-1)}
  else if(event.key==='Home'){event.preventDefault();setActive(0)}
  else if(event.key==='End'){event.preventDefault();setActive(Math.max(0,shown.length-1))}
  else if(event.key==='Enter'&&shown[active]){
   event.preventDefault();choose(shown[active]);
  }else if(event.key==='Tab')close();
 };
 const openPopup=open&&!disabled&&typeof document!=='undefined';
 return <span ref={root} className={'polished-select'+(open?' polished-select-open':'')+(disabled?' polished-select-disabled':'')}>
  <select {...rest} ref={realSelect} className={'polished-select-native '+className}
   style={style} value={chosen} disabled={disabled}
   aria-haspopup="listbox" aria-expanded={open} aria-controls={open?listId:undefined}
   onKeyDown={event=>{keys(event);onKeyDown?.(event)}}
   onChange={event=>{setInternal(event.target.value);onChange?.(event)}}>
   {children}
  </select>
  <button type="button" tabIndex={-1} aria-hidden="true" disabled={disabled}
   className="polished-select-hitbox" onClick={()=>open?close():show()}/>
  <ChevronDown size={15} className="polished-select-arrow" aria-hidden="true"/>
  {openPopup&&createPortal(<div ref={popup} className="polished-select-popup" id={listId}
   role="listbox" aria-label={'Варианты: '+title} style={{left:placement.left,top:placement.top,
    width:placement.width,maxHeight:placement.maxHeight}}>
   {searchEnabled&&<div className="polished-select-search">
    <Search size={15} aria-hidden="true"/>
    <input ref={search} type="search" aria-label={'Поиск: '+title} placeholder="Найти в списке…"
     value={query} onChange={e=>{setQuery(e.target.value);setActive(0)}}
     onKeyDown={keys} autoComplete="off"/>
    {query&&<button type="button" aria-label="Очистить поиск" onClick={()=>{setQuery('');setActive(0);search.current?.focus()}}><X size={14}/></button>}
   </div>}
   <div className="polished-select-options">
    {shown.length===0?<div className="polished-select-empty">Совпадений не найдено</div>
     :shown.map((option,i)=><button type="button" role="option"
      key={option.value+'-'+i} disabled={option.disabled} aria-selected={option.value===chosen}
      className={'polished-select-option'+(option.value===chosen?' is-selected':'')+(active===i?' is-active':'')}
      onMouseEnter={()=>setActive(i)}
      onClick={()=>choose(option)}>
      {option.group&&(!i||option.group!==shown[i-1]?.group)&&<span className="polished-select-group">{option.group}</span>}
      <span className="polished-select-option-text" title={option.label}>{option.label}</span>
      {option.value===chosen&&<Check size={15} aria-hidden="true" className="polished-select-check"/>}
     </button>)}
   </div>
   <div className="polished-select-footer">{query?shown.length+' найдено':options.length+' вариантов'}</div>
  </div>,document.body)}
 </span>;
}
