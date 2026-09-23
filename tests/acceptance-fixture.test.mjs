import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateTournament} from '../src/tournament-domain.js';

const payload=JSON.parse(readFileSync(new URL('../public/acceptance/autumn-bidv-2026/fixture.json',import.meta.url),'utf8'));
const tournament=Object.values(payload.tournamentDocument.tournaments)[0];

test('real tournament acceptance fixture has frozen provenance and exact cardinality',()=>{
  assert.equal(payload.applicationSourceSha,'af0c9c5d6169e240a1e401ffe9406066accc681f');
  assert.equal(payload.fixtureVersion,'autumn-bidv-2026-v1.0.0');
  assert.equal(tournament.name,'THE AUTUMN – BIDV TỪ LIÊM OPEN 2026');
  assert.equal(tournament.acceptanceFixture.eventDate,'2026-09-27');
  assert.deepEqual(payload.summary,{players:64,entries:32,groups:8,poolMatches:48,assignments:8,quarterfinalTemplates:8});
  assert.equal(validateTournament(tournament),true);
});

test('every player and pair has stable unique identity independent of display name',()=>{
  assert.equal(new Set(tournament.structure.players.map(item=>item.id)).size,64);
  assert.equal(new Set(tournament.structure.entries.map(item=>item.id)).size,32);
  assert.ok(tournament.structure.players.filter(item=>item.displayName==='Mr Tuấn').length>1);
  assert.equal(new Set(tournament.structure.players.filter(item=>item.displayName==='Mr Tuấn').map(item=>item.id)).size,2);
  for(const entry of tournament.structure.entries){assert.equal(entry.type,'double');assert.equal(entry.playerIds.length,2)}
});

test('each category has four groups, sixteen entries and twenty-four unique round-robin matches',()=>{
  for(const category of ['mens','mixed']){
    const groups=tournament.structure.groups.filter(item=>item.categoryId===`category:${category}`);
    const entries=tournament.structure.entries.filter(item=>item.categoryId===`category:${category}`);
    const matches=tournament.schedule.filter(item=>item.categoryId===`category:${category}`);
    assert.equal(groups.length,4);assert.equal(entries.length,16);assert.equal(matches.length,24);
    for(const group of groups){
      const pool=matches.filter(item=>item.groupId===group.id),identities=pool.map(item=>item.sourceIdentity.entrantIds.join('|'));
      assert.equal(pool.length,6);assert.equal(new Set(identities).size,6);
    }
  }
});

test('rules, courts, knockout and unresolved source facts are represented without inference',()=>{
  const groupRules=tournament.rulesVersions.find(item=>item.id==='rules:group-stage:v1');
  const finalRules=tournament.rulesVersions.find(item=>item.id==='rules:final:v1');
  assert.deepEqual(groupRules.format,{sets:1,points:11,rule:'touch'});assert.deepEqual(groupRules.procedures.sideChange.atPoints,[6]);
  assert.deepEqual(finalRules.format,{sets:1,points:15,rule:'maximum',cap:21});assert.deepEqual(finalRules.procedures.sideChange.atPoints,[8]);
  assert.deepEqual(groupRules.procedures.timeout,{perGame:1,durationSeconds:60});assert.deepEqual(groupRules.procedures.medical,{durationSeconds:300});
  assert.equal(groupRules.procedures.noShow.autoAdjudicate,false);assert.equal(groupRules.procedures.noShow.lateAfterSeconds,900);
  assert.deepEqual(tournament.rankingRulesVersions[0].criteria.map(item=>item.metric),['matchWins','headToHead','pointDifferential']);
  assert.equal(tournament.rankingRulesVersions[0].points.win,1);assert.equal(tournament.rankingRulesVersions[0].points.loss,0);
  for(const group of ['A','B','C','D'])assert.equal(new Set(tournament.schedule.filter(item=>item.categoryId==='category:mixed'&&item.groupId===`group:mixed:${group}`).map(item=>item.courtId)).size,1);
  assert.ok(tournament.schedule.filter(item=>['group:mens:C','group:mens:D'].includes(item.groupId)).every(item=>item.courtId===null));
  assert.equal(tournament.acceptanceFixture.knockout.templates.length,8);
  assert.equal(tournament.acceptanceFixture.knockout.semifinal.status,'NEEDS_CONFIRMATION');
  assert.deepEqual(tournament.acceptanceFixture.sourceReview.orderDiscrepancies,[]);
});
