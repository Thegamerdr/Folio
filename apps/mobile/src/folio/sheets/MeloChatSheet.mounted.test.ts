import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/folio/sheets/meloToolSuggestion', () => import('./meloToolSuggestion'));

(globalThis as any).requestAnimationFrame = (callback: () => void) => { callback(); return 1; };
(globalThis as any).cancelAnimationFrame = () => undefined;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const { dims, kb, alertSpy, openSettings, focusSpy, applyTool, undoSpy, buildTurnSpy, enrichTurnSpy, voice, state, t } = vi.hoisted(() => ({
  dims: { fontScale: 1, width: 390 }, kb: new Map<string, () => void>(), alertSpy: vi.fn(), openSettings: vi.fn(), focusSpy: vi.fn(), applyTool: vi.fn(), undoSpy: vi.fn(),
  buildTurnSpy: vi.fn(), enrichTurnSpy: vi.fn(),
  voice: { phase: 'idle', permissionDenied: false, error: undefined, transcript: '', route: undefined,
    requestStart: vi.fn(async () => 'needs-phone-service-consent'), startWithPhoneService: vi.fn(), stop: vi.fn(), discard: vi.fn(), setTranscript: vi.fn() },
  state: { melo: { tone: 'calm' }, subs: [], subPaused: {}, onboarding: { name: 'Test' }, workspaces: [{ id: 'personal', kind: 'personal', name: 'Personal' }], activeWorkspaceId: 'personal', transactions: [], debts: [], accounts: [], pots: [] },
  t: { paper:'#fff',surface:'#fff',inset:'#eee',ink:'#111',muted:'#777',calm:'#ddd',calmStrong:'#222',inverse:'#fff',hairline:'#ccc',hairlineStrong:'#aaa',danger:'#b00',warning:'#c90' },
}));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  const el = (name: string) => (props: any) => ReactModule.createElement(name, props, props.children);
  return ({
  AccessibilityInfo: { isReduceMotionEnabled: vi.fn(async () => false), addEventListener: vi.fn((n: string, cb: any) => { kb.set(n, cb); return { remove: () => kb.delete(n) }; }), announceForAccessibility: vi.fn(), setAccessibilityFocus: focusSpy },
  Animated: { Value: class { setValue(_: number) {} }, timing: vi.fn(() => ({ start: vi.fn() })), parallel: vi.fn(() => ({ start: vi.fn() })), View: el('Animated.View') },
  Easing: { inOut: (x:any) => x, cubic: (x:any) => x, bezier: (x:number,y:number,z:number,w:number) => [x,y,z,w] }, Keyboard: { addListener: vi.fn((n:string,cb:any) => { kb.set(n,cb); return { remove:()=>kb.delete(n) }; }), dismiss: vi.fn() },
  Linking: { openSettings, openURL: vi.fn(async()=>undefined) }, Pressable: el('Pressable'), ScrollView: el('ScrollView'),
  StyleSheet: { create: (x:any)=>x, hairlineWidth: 1 }, Text: el('Text'), TextInput: el('TextInput'), View: el('View'), findNodeHandle: vi.fn(()=>1), useWindowDimensions: vi.fn(()=>dims),
  });
});
vi.mock('@/folio/ui/meloAlert', () => ({ MeloAlert: { alert: alertSpy } }));
vi.mock('@/folio/theme', () => ({ gap:{xs:4,sm:8,md:12,lg:16,xl:24}, radius:{sm:8,md:12,lg:16}, serif:'serif', Sheet:({children,...p}:any)=>React.createElement('Sheet',p,children), useTheme:()=>t }));
vi.mock('@/folio/copy/copy', () => ({ copy:{global:{melo:{name:'Melo'}}} }));
vi.mock('@/folio/melo/Melo', () => ({ Melo:()=>React.createElement('Melo') }));
vi.mock('@/folio/store', () => ({ applyMeloTool:vi.fn(()=>{ applyTool(); return {applied:true,summary:'Recorded test change.',undo:undoSpy}; }), getState:()=>state, purgeSeedIfReal:(x:any)=>x, setMelo:vi.fn(), useAppStore:(sel:any)=>sel(state) }));
vi.mock('@/folio/lib/undoPolicy', () => ({ UNDO_WINDOW_MS:30000 }));
vi.mock('@/folio/lib/financialPresentation', () => ({ formatMoney:(n:number)=>'£'+Number(n).toFixed(2) }));
vi.mock('@/folio/lib/meloSnapshot', () => ({ buildMeloSnapshot:()=>({workspaceKind:'personal',setupComplete:true,hasMoneyPicture:true,setupNeeds:[],availableNowMinor:1000,totalDebtMinor:0}) }));
vi.mock('@/folio/lib/meloCalculations', () => ({ buildMeloLocalCalculation:vi.fn(()=>null) }));
vi.mock('@/folio/lib/subscriptionIdentity', () => ({ subscriptionPaused:()=>false }));
vi.mock('@/folio/lib/meloSourceFigures', () => ({ buildMeloSourceFigures:()=>({rows:[]}), meloChatStarters:()=>['Check my balance','What is due soon?'] }));
vi.mock('@/folio/lib/meloAccountSelection', () => ({ resolveMeloAccountSelection:()=>({state:'not-requested'}) }));
vi.mock('@/folio/lib/meloSubscriptionRequest', () => ({ resolveMeloSubscriptionRequest:()=>({state:'not-requested'}) }));
vi.mock('@/folio/lib/meloToneGuidance', () => ({ DEFAULT_MELO_TONE:'calm', describeMeloTone:()=> 'Calm and clear.' }));
vi.mock('@/folio/lib/useMeloVoiceTranscript', () => ({ useMeloVoiceTranscript:()=>voice }));
vi.mock('@/folio/sheets/meloLocalAction', () => ({ filterMeloFollowUpChips:(_:any,c:any)=>c, resolveMeloLocalAction:()=>({kind:'prompt',prompt:'What can I ask you?'}) }));
vi.mock('@/folio/sheets/meloPresentation', () => ({ presentMeloReply:(x:any)=>x.reply }));
vi.mock('@/local/localMeloTurn', () => ({ buildLocalMeloTurn:vi.fn((x:any)=>{ buildTurnSpy(x); return { reply:x.prompt.includes('suggest')?'Proposal ready.':'Draft response.', suggestions:x.prompt.includes('suggest')?[{id:'spend-1',name:'log_spend',args:{amount:3,merchant:'Test Merchant'}}]:[], intent:'explain_position',actions:[],followUpChips:['Try a suggested check'],context:null,control:'none' }; }) }));
vi.mock('@/local/localMeloLanguage', () => ({ enrichLocalMeloTurn:vi.fn(async({turn}:any)=>{ enrichTurnSpy(turn); return turn; }) }));
vi.mock('@/local/localLanguagePack', () => ({ getLocalLanguagePackState:vi.fn(async()=>({kind:'not-installed'})), installLocalLanguagePack:vi.fn() }));

import { MeloChatSheet } from './MeloChatSheet';
const props = (prefill = 'hello', seed?: string) => ({ visible:true, onClose:vi.fn(), nav:{go:vi.fn(),openSheet:vi.fn(),back:vi.fn()} as any, pressure:'steady' as any, intent:{prefill, seed} as any });
const mountedTrees: renderer.ReactTestRenderer[] = [];
function renderChat(prefill = 'hello', seed?: string) { let tree!: renderer.ReactTestRenderer; const scrollNode = { scrollTo: vi.fn(), scrollToEnd: vi.fn() }; act(()=>{tree=renderer.create(React.createElement(MeloChatSheet,props(prefill, seed)), { createNodeMock: (element: any) => element.type === 'ScrollView' ? scrollNode : null });}); mountedTrees.push(tree); return { tree, scrollNode }; }
const labelled = (tree: renderer.ReactTestRenderer, label: string) => tree.root.findAll((node) => (node.type as any) === 'Pressable' && node.props.accessibilityLabel === label);

describe('MF13 MeloChatSheet mounted interaction harness', () => {
  beforeEach(()=>{ alertSpy.mockReset(); openSettings.mockReset(); focusSpy.mockReset(); applyTool.mockReset(); undoSpy.mockReset(); Object.assign(voice,{phase:'idle',permissionDenied:false,error:undefined,transcript:''}); voice.requestStart.mockClear(); voice.discard.mockClear(); dims.fontScale=1; dims.width=390; });
  afterEach(()=>{ for (const tree of mountedTrees.splice(0)) act(()=>tree.unmount()); });
  it('replaces an existing draft from a mounted follow-up without sending',async()=>{ const {tree}=renderChat(); await act(async()=>{await labelled(tree,'Send message')[0]!.props.onPress();}); const buildsBeforeSuggestion=buildTurnSpy.mock.calls.length; const enrichmentsBeforeSuggestion=enrichTurnSpy.mock.calls.length; act(()=>tree.root.findByProps({accessibilityLabel:'Message Melo'}).props.onChangeText('existing draft')); act(()=>labelled(tree,'Try a suggested check')[0]!.props.onPress()); expect(tree.root.findByProps({accessibilityLabel:'Message Melo'}).props.value).toBe('Try a suggested check'); expect(buildTurnSpy).toHaveBeenCalledTimes(buildsBeforeSuggestion); expect(enrichTurnSpy).toHaveBeenCalledTimes(enrichmentsBeforeSuggestion); expect(applyTool).not.toHaveBeenCalled(); });
  it('reveals Tune and restores the prior scroll offset through mounted node methods',async()=>{ const {tree,scrollNode}=renderChat(); await act(async()=>{await labelled(tree,'Send message')[0]!.props.onPress();}); const scroll=tree.root.findAll((node)=>(node.type as any)==='ScrollView')[0]!; act(()=>scroll.props.onScroll({nativeEvent:{contentOffset:{y:120},contentSize:{height:1000},layoutMeasurement:{height:400}}})); const tune=labelled(tree,'Chat settings')[0]!; act(()=>tune.props.onPress()); expect(tune.props.accessibilityState.expanded).toBe(true); expect(scrollNode.scrollTo).toHaveBeenCalledWith({y:0,animated:false}); act(()=>labelled(tree,'Chat settings')[0]!.props.onPress()); expect(labelled(tree,'Chat settings')[0]!.props.accessibilityState.expanded).toBe(false); expect(scrollNode.scrollTo).toHaveBeenLastCalledWith({y:120,animated:false}); });
  it('surfaces phone consent and independently focuses Not now/Open settings actions',async()=>{ const {tree}=renderChat(); await act(async()=>{await labelled(tree,'Use voice')[0]!.props.onPress();}); expect(alertSpy).toHaveBeenCalledWith('Use your phone’s speech service?',expect.any(String),expect.arrayContaining([expect.objectContaining({text:'Not now'}),expect.objectContaining({text:'Continue'})])); Object.assign(voice,{permissionDenied:true,error:'Microphone permission is needed.'}); act(()=>tree.update(React.createElement(MeloChatSheet,props()))); expect(labelled(tree,'Not now')).toHaveLength(1); expect(labelled(tree,'Open microphone settings')).toHaveLength(1); expect(focusSpy).toHaveBeenCalled(); act(()=>labelled(tree,'Open microphone settings')[0]!.props.onPress()); expect(openSettings).toHaveBeenCalledTimes(1); act(()=>labelled(tree,'Not now')[0]!.props.onPress()); expect(voice.discard).toHaveBeenCalledTimes(1); });
  it('keeps a suggestion transcript-only until Confirm, then exposes one Undo',async()=>{ const {tree}=renderChat(); act(()=>tree.root.findByProps({accessibilityLabel:'Message Melo'}).props.onChangeText('suggest a change')); await act(async()=>{await labelled(tree,'Send message')[0]!.props.onPress();}); expect(applyTool).not.toHaveBeenCalled(); expect(labelled(tree,'Confirm log spend suggestion')).toHaveLength(1); act(()=>labelled(tree,'Confirm log spend suggestion')[0]!.props.onPress()); expect(applyTool).toHaveBeenCalledTimes(1); expect(labelled(tree,'Undo this change')).toHaveLength(1); act(()=>labelled(tree,'Undo this change')[0]!.props.onPress()); expect(undoSpy).toHaveBeenCalledTimes(1); expect(labelled(tree,'Undo this change')).toHaveLength(0); });
  it('keeps the seeded opening context inside the transcript owner when the keyboard appears',()=>{ const {tree,scrollNode}=renderChat('', 'Opening money question'); const transcriptScroll=tree.root.findAll((node)=>(node.type as any)==='ScrollView')[0]!; act(()=>kb.get('keyboardDidShow')?.()); const seeded=transcriptScroll.findAll((node)=>(node.type as any)==='Text' && node.children.join('')==='Opening money question'); expect(seeded).toHaveLength(1); expect(tree.root.findAll((node)=>(node.type as any)==='Text' && node.children.join('')==='Opening money question')).toHaveLength(1); expect(scrollNode.scrollToEnd).toHaveBeenCalled(); });
});

describe('controller real-helper interaction checks', () => {
  it('prevents duplicate financial handlers from stale Confirm and Undo event callbacks', async () => {
    applyTool.mockClear(); undoSpy.mockClear();
    const {tree} = renderChat('suggest a change');
    await act(async () => { await labelled(tree, 'Send message')[0]!.props.onPress(); });
    const confirm = labelled(tree, 'Confirm log spend suggestion')[0]!.props.onPress;
    act(() => { confirm(); confirm(); });
    expect(applyTool).toHaveBeenCalledTimes(1);
    const undo = labelled(tree, 'Undo this change')[0]!.props.onPress;
    act(() => { undo(); undo(); });
    expect(undoSpy).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });
});
