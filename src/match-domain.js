export const RULES_VERSION = 'USA-Pickleball-2026-side-out';
export const MATCH_SCHEMA_VERSION = 3;
const teams = ['A', 'B'];
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export function validateMatchSetup(config, final) {
  if (!config || !['single', 'double'].includes(config.type)) throw Error('Chọn Đánh đơn hoặc Đánh đôi.');
  if (config.scoring && config.scoring !== 'side-out') throw Error('V1 chỉ hỗ trợ side-out scoring.');
  if (![1, 3, 5].includes(config.sets)) throw Error('Số game phải là 1, 3 hoặc 5.');
  if (!integer(config.points, 1, 99)) throw Error('Điểm thắng phải từ 1 đến 99.');
  if (!['touch', 'unlimited', 'maximum'].includes(config.rule)) throw Error('Chọn cách xác định game thắng.');
  if (config.rule === 'maximum' && !integer(config.cap, config.points, 99)) throw Error('Điểm tối đa phải lớn hơn hoặc bằng điểm thắng.');
  for (const team of teams) {
    if (!integer(config.start?.[team], 0, 99)) throw Error('Điểm khởi đầu phải từ 0 đến 99.');
    if (!Array.isArray(config.players?.[team]) || config.players[team].length !== (config.type === 'single' ? 1 : 2) ||
      config.players[team].some(name => typeof name !== 'string' || !name.trim())) throw Error('Cần tên đầy đủ cho các vận động viên.');
  }
  if (!final || !teams.includes(final.serving) || !teams.includes(final.courtLeft)) throw Error('Xác định đội giao và bên sân trước trận.');
  if (config.type === 'double' && (!teams.every(team => integer(final.right?.[team], 0, 1)) ||
    !integer(final.serverIndex, 0, 1))) throw Error('Xác định vị trí và người giao đầu tiên.');
  return true;
}

export function validateMatchState(state) {
  if (!state || !state.id || !['playing', 'gameEnd', 'finished'].includes(state.status)) throw Error('Trạng thái trận không hợp lệ.');
  validateMatchSetup(state.config, {serving: state.serving, courtLeft: state.courtLeft,
    right: {A: 0, B: 0}, serverIndex: 0});
  if (![state.currentGamePoints?.A, state.currentGamePoints?.B].every(value => integer(value, 0, 99)) ||
    !integer(state.game, 1, state.config.sets) ||
    (state.config.type === 'double' && ![1, 2].includes(state.serverNumber))) throw Error('Trạng thái điểm hoặc lượt giao không hợp lệ.');
  if(!Array.isArray(state.completedGames)||!state.gamesWon||!teams.every(team=>integer(state.gamesWon[team],0,state.config.sets)))throw Error('Lịch sử game không hợp lệ.');
  const derived={A:0,B:0};
  for(const [index,game] of state.completedGames.entries()){
    if(game.gameNumber!==index+1||![game.points?.A,game.points?.B].every(value=>integer(value,0,99))||game.points.A===game.points.B||!teams.includes(game.winner)||game.winner!==(game.points.A>game.points.B?'A':'B'))throw Error('Kết quả game đã hoàn tất không hợp lệ.');
    derived[game.winner]++;
  }
  if(derived.A!==state.gamesWon.A||derived.B!==state.gamesWon.B)throw Error('Số game thắng không khớp lịch sử game.');
  if (!Array.isArray(state.events) || !Array.isArray(state.undo) || !Array.isArray(state.redo)) throw Error('Thiếu lịch sử transition.');
  return true;
}
