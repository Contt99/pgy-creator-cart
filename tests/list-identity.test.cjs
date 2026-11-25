const vm=require('node:vm');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const listeners={};
class XHR {
  addEventListener(name,callback){this[name]=callback;}
  getResponseHeader(){return 'application/json';}
  send(){}
}
class Node {}
const context={document:{addEventListener:(name,fn)=>listeners[name]=fn},window:{},Node,XMLHttpRequest:XHR,URL,location:{href:'https://pgy.xiaohongshu.com/solar/pre-trade/note/kol',pathname:'/solar/pre-trade/note/kol'}};
vm.runInNewContext(fs.readFileSync('src/content/json-response-observer.js','utf8'),context);
vm.runInNewContext(fs.readFileSync('src/content/list-identity.js','utf8'),context);
const request=new XHR();request.send();
request.responseText=JSON.stringify({data:{list:[
  {userId:'000000000000000000000001',name:'同名达人',redId:'redOne',headPhoto:'https://img.example/avatar/one.jpg'},
  {userId:'000000000000000000000002',name:'同名达人',redId:'redTwo',headPhoto:'https://img.example/avatar/two.jpg'}
]}});request.load();
function resolve(avatar){
  const attrs={}; const card={querySelector:()=>({getAttribute:()=>avatar})};
  const anchor={textContent:'同名达人',matches:()=>true,closest:()=>card,parentElement:card,getAttribute:k=>attrs[k],setAttribute:(k,v)=>attrs[k]=v};
  listeners['pgy-cart-resolve-list-identity']({target:anchor});
  return JSON.parse(attrs['data-pgy-list-identity']);
}
assert.equal(resolve('https://cdn.example/avatar/one.jpg?width=100').redId,'redOne');
assert.equal(resolve('https://cdn.example/avatar/two.jpg').redId,'redTwo');
assert.equal(resolve('https://cdn.example/avatar/unknown.jpg'),null);
request.responseText=JSON.stringify({userId:'000000000000000000000003',name:'同名达人',headPhoto:'https://img.example/avatar/one.jpg'});request.load();
assert.equal(resolve('https://cdn.example/avatar/one.jpg'),null,'ambiguous name and avatar must fail closed');
console.log('list identity response tests passed');
