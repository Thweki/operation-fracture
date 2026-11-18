import {build} from 'esbuild';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';

async function assemble(){
  const [bundle, template, css, license]=await Promise.all([
    build({entryPoints:['app.js'],bundle:true,minify:true,format:'iife',target:'es2020',write:false,legalComments:'inline'}),
    readFile('index.html','utf8'),readFile('style.css','utf8'),readFile('node_modules/three/LICENSE','utf8'),
  ]);
  const javascript=bundle.outputFiles[0].text.replaceAll('</script','<\\/script');
  return template
    .replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+css+'</style>')
    .replace('<script type="module" src="./app.js"></script>',()=>'<script>/*!\n'+license+'\n*/\n'+javascript+'</script>');
}

const dev=process.argv.includes('--dev'), preview=process.argv.includes('--preview');
if(dev||preview){
  const portArg=process.argv.indexOf('--port');
  const port=Number(portArg===-1?process.env.PORT||5173:process.argv[portArg+1]);
  createServer(async(req,res)=>{
    const path=req.url?.split('?')[0];
    if(path!=='/'&&path!=='/index.html'){res.writeHead(404).end();return}
    try{
      const html=dev?await assemble():await readFile('dist/index.html');
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(html);
    }catch(error){
      console.error(error);
      res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'}).end('场景构建失败，请查看终端输出。');
    }
  }).listen(port,'127.0.0.1',()=>console.log('Operation Fracture · http://127.0.0.1:'+port+'/'));
}else{
  const html=await assemble();
  await mkdir('dist',{recursive:true});
  await writeFile('dist/index.html',html);
  console.log('Offline experience ready in dist/index.html ('+Math.round(Buffer.byteLength(html)/1024)+' KiB).');
}
