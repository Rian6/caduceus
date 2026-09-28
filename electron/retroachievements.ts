const base='https://retroachievements.org/API/';
export class RetroAchievements {
  private credentials:{user:string;key:string}|null=null;
  private cache=new Map<string,{at:number;data:any}>();
  private generation=0;
  constructor(private request:typeof fetch=fetch) {}
  status(){return {user:this.credentials?.user||null}}
  disconnect(){this.generation++;this.credentials=null;this.cache.clear();return this.status()}
  private async get(endpoint:string,params:Record<string,string>,credentials=this.credentials):Promise<any> {
    if(!credentials)throw new Error('Conecte sua conta RetroAchievements primeiro.');
    const url=new URL(endpoint,base);
    url.search=new URLSearchParams({...params,u:credentials.user,y:credentials.key}).toString();
    let response:Response;
    try {response=await this.request(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000)})}
    catch {throw new Error('Não foi possível acessar o RetroAchievements. Confira a conexão e tente novamente.');}
    if(response.status===401||response.status===403)throw new Error('Acesso negado. Confira sua Web API Key.');
    if(response.status===429)throw new Error('Limite de consultas atingido. Aguarde um minuto antes de tentar novamente.');
    if(response.status===404)throw new Error('Usuário ou jogo não encontrado no RetroAchievements.');
    if(!response.ok)throw new Error('O RetroAchievements está indisponível. Tente novamente mais tarde.');
    let data:any;try{data=await response.json()}catch{throw new Error('Resposta inválida do RetroAchievements.');}
    if(!data||data.Error||data.Success===false)throw new Error('Não foi possível consultar os dados. Confira o usuário e a Web API Key.');
    return data;
  }
  async connect(user:unknown,key:unknown){
    if(typeof user!=='string'||!user.trim()||user.length>100||typeof key!=='string'||!key.trim()||key.length>256)throw new Error('Informe o usuário e a Web API Key do RetroAchievements.');
    const version=++this.generation;
    const credentials={user:user.trim(),key:key.trim()};
    const profile=await this.get('API_GetUserProfile.php',{},credentials);
    if(typeof profile.User!=='string')throw new Error('Usuário não encontrado.');
    if(version!==this.generation)throw new Error('Conexão cancelada.');
    this.credentials={...credentials,user:profile.User};this.cache.clear();return this.status();
  }
  private async cached(id:string,endpoint:string,params:Record<string,string>){
    if(!this.credentials)throw new Error('Conecte sua conta RetroAchievements primeiro.');
    const old=this.cache.get(id);if(old&&Date.now()-old.at<60000)return old.data;
    const version=this.generation;
    const data=await this.get(endpoint,params);
    if(version!==this.generation)throw new Error('A conexão foi alterada. Consulte novamente.');
    if(this.cache.size>=50)this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(id,{at:Date.now(),data});return data;
  }
  async games(page:unknown){
    if(typeof page!=='number'||!Number.isInteger(page)||page<0||page>10000)throw new Error('Página inválida.');
    const data=await this.cached('games:'+page,'API_GetUserCompletionProgress.php',{o:String(page*100),c:'100'});
    if(!Array.isArray(data.Results))throw new Error('Lista de jogos inválida.');
    return {total:Number(data.Total)||0,games:data.Results.map((g:any)=>({id:Number(g.GameID),title:String(g.Title||''),console:String(g.ConsoleName||''),image:raImage(g.ImageIcon),total:Number(g.MaxPossible)||0,earned:Number(g.NumAwarded)||0,hardcore:Number(g.NumAwardedHardcore)||0}))};
  }
  async game(id:unknown){
    if(typeof id!=='number'||!Number.isInteger(id)||id<=0)throw new Error('Jogo inválido.');
    const data=await this.cached('game:'+id,'API_GetGameInfoAndUserProgress.php',{g:String(id)});
    return {title:String(data.Title||''),achievements:Object.values(data.Achievements||{}).map((a:any)=>({id:Number(a.ID),title:String(a.Title||''),description:String(a.Description||''),points:Number(a.Points)||0,image:/^\d+$/.test(String(a.BadgeName))?`https://media.retroachievements.org/Badge/${a.BadgeName}.png`:null,earned:!!(a.DateEarned||a.DateEarnedHardcore),hardcore:!!a.DateEarnedHardcore,date:String(a.DateEarnedHardcore||a.DateEarned||'')}))};
  }
}
function raImage(value:unknown){return typeof value==='string'&&/^\/Images\/[\w.-]+$/.test(value)?'https://media.retroachievements.org'+value:null}
