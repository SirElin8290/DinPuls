(()=>{
  "use strict";
  const nativeFetch=window.fetch.bind(window);
  const ENGINE_VERSION="1.0.0";
  const STATUS_MAP={scheduled:"scheduled",notstarted:"scheduled",upcoming:"scheduled",live:"live",inprogress:"live",playing:"live",finished:"finished",final:"finished",ended:"finished",postponed:"postponed",cancelled:"cancelled",canceled:"cancelled"};
  const text=value=>String(value??"").trim();
  const numberOrNull=value=>value===""||value===null||value===undefined?null:Number.isFinite(Number(value))?Number(value):null;
  const normalizeStatus=value=>STATUS_MAP[text(value).toLowerCase().replace(/[ _-]/g,"")]||"scheduled";
  const normalizeDate=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toISOString()};
  const stableId=match=>[match.sourceId,match.competition,match.startTime,match.homeTeam,match.awayTeam].filter(Boolean).join("|").toLowerCase().replace(/[^a-z0-9åäö]+/gi,"-");

  function normalizeMatch(raw,defaults={}){
    const match={
      id:text(raw.id||raw.matchId||raw.gameId),
      sourceId:text(raw.sourceId||defaults.sourceId),
      sourceName:text(raw.sourceName||raw.provider||defaults.sourceName),
      sourceUrl:text(raw.sourceUrl||raw.url||defaults.sourceUrl),
      municipality:text(raw.municipality||defaults.municipality),
      sport:text(raw.sport||defaults.sport||"Sport"),
      competition:text(raw.competition||raw.series||raw.tournament),
      startTime:normalizeDate(raw.startTime||raw.start||raw.date||raw.kickoff),
      status:normalizeStatus(raw.status),
      clock:text(raw.clock||raw.minute||raw.period),
      homeTeam:text(raw.homeTeam||raw.home||raw.teamHome),
      awayTeam:text(raw.awayTeam||raw.away||raw.teamAway),
      homeScore:numberOrNull(raw.homeScore??raw.scoreHome),
      awayScore:numberOrNull(raw.awayScore??raw.scoreAway),
      venue:text(raw.venue||raw.arena||raw.location),
      updatedAt:normalizeDate(raw.updatedAt||defaults.updatedAt)||new Date().toISOString()
    };
    if(!match.id)match.id=stableId(match);
    if(!match.startTime||!match.homeTeam||!match.awayTeam)return null;
    return match;
  }

  function deduplicate(matches){
    const map=new Map();
    matches.forEach(match=>{
      if(!match)return;
      const key=match.id||stableId(match);
      const previous=map.get(key);
      if(!previous||new Date(match.updatedAt)>=new Date(previous.updatedAt))map.set(key,match);
    });
    return [...map.values()].sort((a,b)=>new Date(a.startTime)-new Date(b.startTime));
  }

  function mergeData(base,feed){
    const merged=structuredClone(base||{});
    merged.engine={version:ENGINE_VERSION,loadedAt:new Date().toISOString(),feedGeneratedAt:feed?.generatedAt||null};
    merged.sourceHealth=feed?.sources||[];
    merged.municipalities=merged.municipalities||{};
    Object.entries(feed?.municipalities||{}).forEach(([municipality,payload])=>{
      const target=merged.municipalities[municipality]||(merged.municipalities[municipality]={clubs:[],liveSources:[]});
      const rawMatches=[...(target.matches||[]),...(target.fixtures||[]),...(payload.matches||[]),...(payload.fixtures||[])];
      target.matches=deduplicate(rawMatches.map(raw=>normalizeMatch(raw,{municipality,updatedAt:feed.generatedAt})));
      target.dataStatus={
        matchCount:target.matches.length,
        generatedAt:feed.generatedAt||merged.generatedAt||null,
        stale:feed.generatedAt?Date.now()-new Date(feed.generatedAt).getTime()>6*60*60*1000:true
      };
    });
    Object.entries(merged.municipalities).forEach(([municipality,target])=>{
      if(target.dataStatus)return;
      const rawMatches=[...(target.matches||[]),...(target.fixtures||[])];
      target.matches=deduplicate(rawMatches.map(raw=>normalizeMatch(raw,{municipality,updatedAt:merged.generatedAt})));
      target.dataStatus={matchCount:target.matches.length,generatedAt:merged.generatedAt||null,stale:true};
    });
    return merged;
  }

  async function loadMergedSportsData(request,options){
    const [baseResponse,feedResponse]=await Promise.all([
      nativeFetch(request,options),
      nativeFetch(`data/sport-feeds.json`,{cache:"no-store"}).catch(()=>null)
    ]);
    if(!baseResponse.ok)return baseResponse;
    const base=await baseResponse.json();
    let feed={};
    if(feedResponse?.ok){try{feed=await feedResponse.json()}catch(error){console.warn("Sportflödet kunde inte tolkas",error)}}
    const merged=mergeData(base,feed);
    return new Response(JSON.stringify(merged),{status:200,headers:{"Content-Type":"application/json; charset=utf-8","X-DinPuls-Sport-Engine":ENGINE_VERSION}});
  }

  window.fetch=(input,options)=>{
    const url=typeof input==="string"?input:input?.url||"";
    return /(?:^|\/)data\/sports\.json(?:\?|$)/.test(url)?loadMergedSportsData(input,options):nativeFetch(input,options);
  };
  window.DinPulsSportEngine={version:ENGINE_VERSION,normalizeMatch,mergeData};
})();