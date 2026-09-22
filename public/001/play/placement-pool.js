(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.PlacementPool=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const TARGET_ORDER=['streak','sCurve','spot','dust','pet','tissue'];
  const DUST_OFFSETS=[[-30,-16],[26,-16],[-24,18],[30,18]];
  const OBSTACLES=[[18,158,49,53],[17,451,41,37],[305,452,24,28]];

  // Every entry comes from Six-Layout v10 or Context Test v2.
  const POOLS={
    streak:[
      {slot:'left_mid_horizontal',x:95,y:300,orientation:'horizontal'},
      {slot:'center_right_vertical',x:220,y:325,orientation:'vertical'},
      {slot:'elevator_right_vertical',x:205,y:235,orientation:'vertical'},
      {slot:'elevator_left_vertical',x:126,y:240,orientation:'vertical'},
      {slot:'center_horizontal',x:180,y:286,orientation:'horizontal'},
      {slot:'right_upper_horizontal',x:237,y:263,orientation:'horizontal'},
      {slot:'desk_front_horizontal',x:92,y:238,orientation:'horizontal'},
      {slot:'far_left_vertical',x:66,y:328,orientation:'vertical'},
      {slot:'bin_path_vertical',x:294,y:304,orientation:'vertical'},
      {slot:'lower_floor_horizontal',x:210,y:425,orientation:'horizontal'}
    ],
    sCurve:[
      {slot:'upper_center',x:160,y:220},
      {slot:'lower_left',x:105,y:394},
      {slot:'mid_left',x:105,y:330},
      {slot:'upper_right',x:217,y:280},
      {slot:'lower_right',x:230,y:385},
      {slot:'far_upper_left',x:92,y:245},
      {slot:'far_mid_right',x:282,y:330},
      {slot:'entrance_lower_center',x:180,y:407}
    ],
    spot:[
      {slot:'lower_right',x:296,y:400},
      {slot:'upper_right',x:298,y:252},
      {slot:'lower_left_edge',x:65,y:410},
      {slot:'bin_left_front',x:292,y:239},
      {slot:'upper_left_edge',x:86,y:200},
      {slot:'bin_front',x:322,y:239,contextual:true}
    ],
    dust:[
      {slot:'right_mid',x:235,y:285},
      {slot:'center_left',x:140,y:285},
      {slot:'lower_right',x:250,y:385},
      {slot:'lower_left_edge',x:92,y:374},
      {slot:'lower_left',x:109,y:351},
      {slot:'left_mid',x:99,y:302},
      {slot:'desk_side',x:100,y:245},
      {slot:'cart_side',x:102,y:425},
      {slot:'upper_floor',x:218,y:220},
      {slot:'right_side',x:287,y:340}
    ],
    pet:[
      {slot:'lower_left_floor',x:107,y:388},
      {slot:'elevator_left_floor',x:130,y:195},
      {slot:'upper_left_floor',x:92,y:235},
      {slot:'elevator_center_floor',x:199,y:192},
      {slot:'right_edge_floor',x:328,y:263},
      {slot:'desk',x:58,y:171,interactionX:59,interactionY:225,contextual:true}
    ],
    tissue:[
      {slot:'upper_right_floor',x:318,y:246},
      {slot:'lower_right_floor',x:292,y:390},
      {slot:'right_mid_floor',x:320,y:305},
      {slot:'left_mid_edge',x:67,y:299},
      {slot:'umbrella',x:297,y:477,interactionX:288,interactionY:466,contextual:true},
      {slot:'right_edge_floor',x:332,y:320}
    ]
  };

  const FALLBACK_SLOTS={
    streak:'left_mid_horizontal',
    sCurve:'upper_center',
    spot:'lower_right',
    dust:'right_mid',
    pet:'lower_left_floor',
    tissue:'upper_right_floor'
  };

  const cloneSlot=slot=>({...slot});
  const centerOf=(target,slot)=>({
    x:slot.interactionX??slot.x,
    y:slot.interactionY??slot.y
  });

  function blocked(x,y){
    return x<30||x>330||y<180||y>468||OBSTACLES.some(([left,top,width,height])=>
      x>left-9&&x<left+width+9&&y>top-4&&y<top+height+8
    );
  }

  function visualBounds(target,slot){
    if(target==='streak')return slot.orientation==='vertical'
      ?{left:slot.x-15,right:slot.x+15,top:slot.y-49,bottom:slot.y+49}
      :{left:slot.x-49,right:slot.x+49,top:slot.y-15,bottom:slot.y+15};
    if(target==='sCurve')return{left:slot.x-49,right:slot.x+49,top:slot.y-31,bottom:slot.y+31};
    if(target==='spot')return{left:slot.x-15,right:slot.x+15,top:slot.y-11,bottom:slot.y+11};
    if(target==='dust')return{left:slot.x-37,right:slot.x+37,top:slot.y-23,bottom:slot.y+25};
    if(target==='pet')return{left:slot.x-5,right:slot.x+5,top:slot.y-13,bottom:slot.y+7};
    return{left:slot.x-9,right:slot.x+9,top:slot.y-7,bottom:slot.y+7};
  }

  function overlapRatio(a,b){
    const width=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
    const height=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    if(!width||!height)return 0;
    const area=width*height;
    const aArea=(a.right-a.left)*(a.bottom-a.top);
    const bArea=(b.right-b.left)*(b.bottom-b.top);
    return area/Math.min(aArea,bArea);
  }

  function hasStandingPoint(target,slot){
    const point=centerOf(target,slot);
    for(let radius=18;radius<=40;radius+=11){
      for(let step=0;step<16;step++){
        const angle=step*Math.PI/8;
        if(!blocked(point.x+Math.cos(angle)*radius,point.y+Math.sin(angle)*radius))return true;
      }
    }
    return false;
  }

  function individualIssue(target,slot){
    const bounds=visualBounds(target,slot);
    if(bounds.left<0||bounds.right>360||bounds.top<110||bounds.bottom>505){
      return{target,reason:'canvas_clipping'};
    }
    if(!hasStandingPoint(target,slot))return{target,reason:'inaccessible_interaction'};
    if(target==='dust'){
      for(const [dx,dy] of DUST_OFFSETS){
        if(blocked(slot.x+dx,slot.y+dy))return{target,reason:'dust_push_area_blocked'};
      }
    }
    if(target==='streak'||target==='sCurve'||target==='spot'){
      const freeHorizontal=Math.min(52,slot.x)-Math.max(-52,-slot.x);
      const freeVertical=Math.min(34,640-slot.y)-Math.max(-34,-slot.y);
      if(freeHorizontal<24&&freeVertical<24)return{target,reason:'mop_path_unusable'};
    }
    return null;
  }

  function pairIssue(firstTarget,firstSlot,secondTarget,secondSlot){
    const firstBounds=visualBounds(firstTarget,firstSlot);
    const secondBounds=visualBounds(secondTarget,secondSlot);
    const ratio=overlapRatio(firstBounds,secondBounds);
    const firstPoint=centerOf(firstTarget,firstSlot);
    const secondPoint=centerOf(secondTarget,secondSlot);
    const interactionDistance=Math.hypot(firstPoint.x-secondPoint.x,firstPoint.y-secondPoint.y);
    const bothSmall=['spot','pet','tissue'].includes(firstTarget)&&['spot','pet','tissue'].includes(secondTarget);
    if(interactionDistance<14)return{target:secondTarget,reason:'interaction_points_collide',with:firstTarget};
    if(bothSmall&&ratio>.6)return{target:secondTarget,reason:'small_targets_indistinguishable',with:firstTarget};
    if(ratio>.72)return{target:secondTarget,reason:'severe_visual_overlap',with:firstTarget};
    return null;
  }

  function findConflict(combination){
    for(const target of TARGET_ORDER){
      const issue=individualIssue(target,combination[target]);
      if(issue)return issue;
    }
    for(let first=0;first<TARGET_ORDER.length;first++){
      for(let second=first+1;second<TARGET_ORDER.length;second++){
        const issue=pairIssue(
          TARGET_ORDER[first],combination[TARGET_ORDER[first]],
          TARGET_ORDER[second],combination[TARGET_ORDER[second]]
        );
        if(issue)return issue;
      }
    }
    return null;
  }

  function combinationSignature(combination){
    return TARGET_ORDER.map(target=>combination[target].slot).join('|');
  }

  function combinationSummary(combination){
    return TARGET_ORDER.map(target=>`${target.toUpperCase()} = ${combination[target].slot}`).join('\n');
  }

  function fallbackCombination(){
    return Object.fromEntries(TARGET_ORDER.map(target=>[
      target,
      cloneSlot(POOLS[target].find(slot=>slot.slot===FALLBACK_SLOTS[target]))
    ]));
  }

  function createGenerator(random=Math.random){
    let previousSignature=null;
    const stats={rounds:0,conflictRerolls:0,fallbacks:0,duplicateRegenerations:0,slotCounts:{}};
    for(const target of TARGET_ORDER){
      stats.slotCounts[target]=Object.fromEntries(POOLS[target].map(slot=>[slot.slot,0]));
    }

    const pick=(target,excludeSlot=null)=>{
      const candidates=excludeSlot?POOLS[target].filter(slot=>slot.slot!==excludeSlot):POOLS[target];
      return cloneSlot(candidates[Math.floor(random()*candidates.length)]);
    };

    function candidate(){
      const combination=Object.fromEntries(TARGET_ORDER.map(target=>[target,pick(target)]));
      let conflict=findConflict(combination);
      let rerolls=0;
      while(conflict&&rerolls<36){
        const target=conflict.target;
        combination[target]=pick(target,combination[target].slot);
        rerolls++;
        conflict=findConflict(combination);
      }
      if(conflict)return{combination:fallbackCombination(),rerolls,fallback:true,lastConflict:conflict};
      return{combination,rerolls,fallback:false,lastConflict:null};
    }

    function generate(){
      let result=candidate();
      let signature=combinationSignature(result.combination);
      if(previousSignature&&signature===previousSignature){
        stats.duplicateRegenerations++;
        result=candidate();
        signature=combinationSignature(result.combination);
      }
      previousSignature=signature;
      stats.rounds++;
      stats.conflictRerolls+=result.rerolls;
      if(result.fallback)stats.fallbacks++;
      for(const target of TARGET_ORDER)stats.slotCounts[target][result.combination[target].slot]++;
      return{
        combination:Object.fromEntries(TARGET_ORDER.map(target=>[target,cloneSlot(result.combination[target])])),
        signature,
        conflictRerolls:result.rerolls,
        fallback:result.fallback,
        lastConflict:result.lastConflict
      };
    }

    return{
      generate,
      stats,
      get previousSignature(){return previousSignature;}
    };
  }

  return{
    TARGET_ORDER,
    POOLS,
    DUST_OFFSETS,
    FALLBACK_SLOTS,
    createGenerator,
    findConflict,
    combinationSignature,
    combinationSummary,
    visualBounds,
    blocked
  };
});
