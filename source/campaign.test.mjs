import test from 'node:test';
import assert from 'node:assert/strict';
import {byId,createCampaign,sectors,missionClock} from './campaign.js';

function saveFile(initial){
  let content=initial;
  return {getItem:()=>content,setItem:(_,value)=>{content=value}};
}

test('both key orders unlock the same arsenal and preserve a selected branch',()=>{
  for(const [first,second] of [['forge','tide'],['tide','forge']]){
    const disk=saveFile(),campaign=createCampaign(disk);
    assert.equal(campaign.gear('scatter'),false);
    assert.equal(campaign.track(byId.ridge),false);
    campaign.clear(byId.garden,40,true);
    assert.equal(campaign.gear('ward'),true);
    campaign.track(byId[second]);
    campaign.clear(byId[first],60,true);
    assert.equal(campaign.gear('arc'),true);
    assert.equal(campaign.gear('lance'),true);
    assert.equal(campaign.gear('orbit'),false);
    const resumed=createCampaign(disk);
    assert.equal(resumed.tracked.id,second);
    resumed.clear(byId[second],54,true);
    assert.equal(resumed.gear('orbit'),true);
    resumed.equip('orbit');
    assert.equal(createCampaign(disk).equipped,'orbit');
    assert.equal(resumed.tracked.id,'ridge');
    assert.equal(resumed.available(byId.gate),false);
  }
});

test('normal and elite checkpoints and full-run records persist independently',()=>{
  const disk=saveFile(),c=createCampaign(disk);
  for(const site of sectors)c.clear(site,52,true);
  c.markWave(byId.gate,2);
  c.markWave(byId.gate,3,true);
  c.markWave(byId.gate,2,true);
  c.track(byId.gate,true);
  const again=createCampaign(disk);
  assert.equal(again.trackedElite,true);
  assert.equal(again.checkpoint.gate,2);
  assert.equal(again.eliteCheckpoint.gate,3);
  again.clear(byId.gate,4,false,true);
  assert.equal(again.trackedElite,false);
  assert.equal(again.eliteBest.gate,undefined);
  assert.equal(again.eliteCheckpoint.gate,undefined);
  assert.equal(again.checkpoint.gate,2);
  assert.equal(again.best.gate,52);
  again.clear(byId.gate,69,true,true);
  again.clear(byId.gate,75,true,true);
  again.track(byId.forge);
  again.clear(byId.gate,47,true);
  const result=createCampaign(disk);
  assert.equal(result.eliteBest.gate,69);
  assert.equal(result.best.gate,47);
  assert.equal(result.checkpoint.gate,undefined);
  assert.equal(result.tracked.id,'forge');
});

test('a bad save cannot unlock isolated sectors, select a prototype or spawn a nonexistent wave',()=>{
  const c=createCampaign(saveFile(JSON.stringify({tracked:'constructor',cleared:['garden','gate'],
    checkpoint:{garden:3,tide:3,gate:2},eliteBest:{gate:5},best:{garden:-3}})));
  assert.deepEqual([...c.cleared],['garden']);
  assert.equal(c.tracked.id,'tide');
  assert.deepEqual(c.checkpoint,{tide:3});
  assert.deepEqual(c.eliteBest,{});
  assert.deepEqual(c.best,{});
  assert.equal(createCampaign(saveFile('{')).tracked.id,'garden');
});

test('record times distinguish subsecond clears and the minute boundary',()=>{
  assert.equal(missionClock(.93),'0:00.9');
  assert.equal(missionClock(59.999),'0:59.9');
  assert.equal(missionClock(60.04),'1:00.0');
});
