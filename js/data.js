/* ============================================================
   智行江畔 V6.6+AI —— 数据层（全部挂到 window 全局，供各模块直接访问）
   坐标系：GCJ-02（高德坐标系），已于 2026-10-12 经高德 POI 检索复核
   ============================================================ */

/* ---------- 校区中心 ---------- */
window.CAMPUS_CENTER = {
  '蛟桥园': [115.855113, 28.744350],
  '麦庐园': [115.816717, 28.728899],
  '枫林园': [115.836021, 28.732546]
};

/* ---------- 校园点位（64个实测坐标，麦庐南/北 + 蛟桥南/北，votes 初始 0） ---------- */
window.spots = [
  /* ============ 麦庐园校区 · 南区 ============ */
  { id: 'ml_xgxy',    name: '信息管理学院',   campus: '麦庐园', area: '南区', lng: 115.813757, lat: 28.725611, type: '学院',   tags: ['学院楼'], votes: 0, rating: 4 },
  { id: 'ml_xihu',    name: '西湖',           campus: '麦庐园', area: '南区', lng: 115.814436, lat: 28.725497, type: '其他',   tags: ['景观'], votes: 0, rating: 5 },
  { id: 'ml_ysxy',    name: '设计与艺术学院', campus: '麦庐园', area: '南区', lng: 115.814566, lat: 28.727076, type: '学院',   tags: ['学院楼'], votes: 0, rating: 4 },
  { id: 'ml_ysnl',    name: '艺术学院南楼',   campus: '麦庐园', area: '南区', lng: 115.814436, lat: 28.726491, type: '学院',   tags: ['学院楼'], votes: 0, rating: 4 },
  { id: 'ml_glxy',    name: '格里菲斯数智学院', campus: '麦庐园', area: '南区', lng: 115.815760, lat: 28.727814, type: '学院', tags: ['学院楼'], votes: 0, rating: 4 },
  { id: 'ml_jsjxy',   name: '计算机与人工智能学院', campus: '麦庐园', area: '南区', lng: 115.816727, lat: 28.727928, type: '学院', tags: ['学院楼'], votes: 0, rating: 4 },
  { id: 'ml_fxy',     name: '法学院',         campus: '麦庐园', area: '南区', lng: 115.818893, lat: 28.726144, type: '学院',   tags: ['学院楼'], votes: 0, rating: 4 },
  { id: 'ml_wgyxy',   name: '外国语学院',     campus: '麦庐园', area: '南区', lng: 115.818992, lat: 28.725174, type: '学院',   tags: ['学院楼'], votes: 0, rating: 4 },
  { id: 'ml_tyxy',    name: '社会体育综合实验教学中心', campus: '麦庐园', area: '南区', lng: 115.818017, lat: 28.728164, type: '体育', tags: ['实验中心'], votes: 0, rating: 3 },
  { id: 'ml_tyg',     name: '体育馆',         campus: '麦庐园', area: '南区', lng: 115.817910, lat: 28.727403, type: '体育',   tags: ['运动'], votes: 0, rating: 4 },
  { id: 'ml_ydc',     name: '运动场',         campus: '麦庐园', area: '南区', lng: 115.818951, lat: 28.729160, type: '体育',   tags: ['运动', '跑步'], votes: 0, rating: 4 },
  { id: 'ml_j1',      name: '一教学楼',       campus: '麦庐园', area: '南区', lng: 115.815811, lat: 28.725659, type: '教学楼', tags: ['上课'], votes: 0, rating: 4 },
  { id: 'ml_j2',      name: '二教学楼',       campus: '麦庐园', area: '南区', lng: 115.818155, lat: 28.725787, type: '教学楼', tags: ['上课'], votes: 0, rating: 4 },
  { id: 'ml_dlt',     name: '南区大礼堂',     campus: '麦庐园', area: '南区', lng: 115.815422, lat: 28.726851, type: '礼堂',   tags: ['活动'], votes: 0, rating: 4 },
  { id: 'ml_dshd',    name: '大学生活动中心', campus: '麦庐园', area: '南区', lng: 115.815306, lat: 28.727335, type: '行政',   tags: ['学生组织', '社团'], votes: 0, rating: 4 },
  { id: 'ml_nanmen',  name: '南区南门',       campus: '麦庐园', area: '南区', lng: 115.816709, lat: 28.724580, type: '其他',   tags: ['校门'], votes: 0, rating: 3 },
  { id: 'ml_yst',     name: '一食堂',         campus: '麦庐园', area: '南区', lng: 115.814502, lat: 28.729938, type: '食堂',   tags: ['餐饮', '吃饭'], votes: 0, rating: 4 },
  { id: 'ml_est',     name: '二食堂',         campus: '麦庐园', area: '南区', lng: 115.817426, lat: 28.730130, type: '食堂',   tags: ['餐饮', '吃饭'], votes: 0, rating: 4 },
  { id: 'ml_sf',      name: '顺丰速运',       campus: '麦庐园', area: '南区', lng: 115.815284, lat: 28.729896, type: '快递',   tags: ['取快递'], votes: 0, rating: 3 },
  { id: 'ml_cn',      name: '菜鸟驿站',       campus: '麦庐园', area: '南区', lng: 115.817204, lat: 28.729876, type: '快递',   tags: ['取快递'], votes: 0, rating: 4 },
  { id: 'ml_yz',      name: '中国邮政',       campus: '麦庐园', area: '南区', lng: 115.816950, lat: 28.728964, type: '快递',   tags: ['取快递', '寄件'], votes: 0, rating: 3 },
  { id: 'ml_kdyz',    name: '快递驿站',       campus: '麦庐园', area: '南区', lng: 115.816926, lat: 28.728869, type: '快递',   tags: ['取快递'], votes: 0, rating: 3 },
  { id: 'ml_jla',     name: '静庐A栋',        campus: '麦庐园', area: '南区', lng: 115.815539, lat: 28.730415, type: '宿舍',   tags: ['住宿'], votes: 0, rating: 4 },
  { id: 'ml_jlb',     name: '静庐B栋',        campus: '麦庐园', area: '南区', lng: 115.814431, lat: 28.730420, type: '宿舍',   tags: ['住宿'], votes: 0, rating: 4 },
  { id: 'ml_jlc',     name: '静庐C栋',        campus: '麦庐园', area: '南区', lng: 115.815887, lat: 28.730748, type: '宿舍',   tags: ['住宿'], votes: 0, rating: 4 },
  { id: 'ml_jld',     name: '静庐D栋',        campus: '麦庐园', area: '南区', lng: 115.815232, lat: 28.730829, type: '宿舍',   tags: ['住宿'], votes: 0, rating: 4 },
  { id: 'ml_jle',     name: '静庐E栋',        campus: '麦庐园', area: '南区', lng: 115.814472, lat: 28.730966, type: '宿舍',   tags: ['住宿'], votes: 0, rating: 4 },
  { id: 'ml_m6',      name: '6号门',          campus: '麦庐园', area: '南区', lng: 115.817317, lat: 28.730360, type: '其他',   tags: ['校门'], votes: 0, rating: 3 },

  /* ============ 麦庐园校区 · 北区 ============ */
  { id: 'ml_gsglxy',  name: '工商管理学院',   campus: '麦庐园', area: '北区', lng: 115.817586, lat: 28.733851, type: '学院',   tags: ['学院楼'], votes: 0, rating: 4 },
  { id: 'ml_bqst',    name: '三食堂',         campus: '麦庐园', area: '北区', lng: 115.818454, lat: 28.733608, type: '食堂',   tags: ['餐饮', '吃饭'], votes: 0, rating: 4 },
  { id: 'ml_bmen',    name: '北区北门',       campus: '麦庐园', area: '北区', lng: 115.817291, lat: 28.734080, type: '其他',   tags: ['校门'], votes: 0, rating: 3 },
  { id: 'ml_bnm',     name: '北区南门',       campus: '麦庐园', area: '北区', lng: 115.816721, lat: 28.731191, type: '其他',   tags: ['校门'], votes: 0, rating: 3 },

  /* ============ 蛟桥园校区 · 南区 ============ */
  { id: 'jq_dshd',    name: '大学生活动中心（蛟桥）', campus: '蛟桥园', area: '南区', lng: 115.853707, lat: 28.738620, type: '行政', tags: ['学生组织', '社团'], votes: 0, rating: 4 },
  { id: 'jq_zzzx',    name: '学生资助管理中心', campus: '蛟桥园', area: '南区', lng: 115.853779, lat: 28.738835, type: '行政', tags: ['资助', '医保'], votes: 0, rating: 4 },
  { id: 'jq_nqst',    name: '南区食堂',       campus: '蛟桥园', area: '南区', lng: 115.855728, lat: 28.738432, type: '食堂',   tags: ['餐饮', '吃饭'], votes: 0, rating: 4 },
  { id: 'jq_xdf',     name: '新东方',         campus: '蛟桥园', area: '南区', lng: 115.854383, lat: 28.740408, type: '商店',   tags: ['培训'], votes: 0, rating: 3 },
  { id: 'jq_nqj1',    name: '南区第一教学楼', campus: '蛟桥园', area: '南区', lng: 115.853843, lat: 28.741197, type: '教学楼', tags: ['上课'], votes: 0, rating: 4 },
  { id: 'jq_sjjx',    name: '计算机实践教学中心', campus: '蛟桥园', area: '南区', lng: 115.854360, lat: 28.741088, type: '教学楼', tags: ['上机'], votes: 0, rating: 4 },
  { id: 'jq_mmyz',    name: '妈妈驿站',       campus: '蛟桥园', area: '南区', lng: 115.853901, lat: 28.740946, type: '快递',   tags: ['取快递'], votes: 0, rating: 3 },
  { id: 'jq_nqbg',    name: '南区综合办公楼', campus: '蛟桥园', area: '南区', lng: 115.854694, lat: 28.741291, type: '行政',   tags: ['办公'], votes: 0, rating: 3 },
  { id: 'jq_gjjl',    name: '国际合作和交流处', campus: '蛟桥园', area: '南区', lng: 115.853829, lat: 28.742062, type: '行政',   tags: ['留学'], votes: 0, rating: 3 },
  { id: 'jq_nm',      name: '蛟桥南区南门',   campus: '蛟桥园', area: '南区', lng: 115.854405, lat: 28.742591, type: '其他',   tags: ['校门'], votes: 0, rating: 3 },

  /* ============ 蛟桥园校区 · 北区 ============ */
  { id: 'jq_gsyh',    name: '中国工商银行',   campus: '蛟桥园', area: '北区', lng: 115.852898, lat: 28.743337, type: '商店',   tags: ['银行', 'ATM'], votes: 0, rating: 3 },
  { id: 'jq_gwc',     name: '财大购物广场',   campus: '蛟桥园', area: '北区', lng: 115.852744, lat: 28.743612, type: '商店',   tags: ['超市', '购物'], votes: 0, rating: 4 },
  { id: 'jq_yz',      name: '中国邮政（蛟桥）', campus: '蛟桥园', area: '北区', lng: 115.853196, lat: 28.743557, type: '快递',   tags: ['取快递'], votes: 0, rating: 3 },
  { id: 'jq_bm',      name: '蛟桥北区南门',   campus: '蛟桥园', area: '北区', lng: 115.854479, lat: 28.743409, type: '其他',   tags: ['校门'], votes: 0, rating: 3 },
  { id: 'jq_kjsxy',   name: '科技商学院',     campus: '蛟桥园', area: '北区', lng: 115.854958, lat: 28.744459, type: '学院',   tags: ['学院楼'], votes: 0, rating: 3 },
  { id: 'jq_spm',     name: '中国税票博物馆', campus: '蛟桥园', area: '北区', lng: 115.853879, lat: 28.744431, type: '其他',   tags: ['博物馆', '参观'], votes: 0, rating: 4 },
  { id: 'jq_yd',      name: '中国移动',       campus: '蛟桥园', area: '北区', lng: 115.854199, lat: 28.744861, type: '商店',   tags: ['营业厅'], votes: 0, rating: 3 },
  { id: 'jq_bqbg',    name: '北区综合办公楼', campus: '蛟桥园', area: '北区', lng: 115.854406, lat: 28.744961, type: '行政',   tags: ['办公'], votes: 0, rating: 3 },
  { id: 'jq_gh',      name: '工会委员会',     campus: '蛟桥园', area: '北区', lng: 115.852935, lat: 28.744593, type: '行政',   tags: ['办公'], votes: 0, rating: 3 },
  { id: 'jq_bqst',    name: '北区食堂',       campus: '蛟桥园', area: '北区', lng: 115.855784, lat: 28.746818, type: '食堂',   tags: ['餐饮', '吃饭'], votes: 0, rating: 4 },
  { id: 'jq_hwjy',    name: '海外教育学院',   campus: '蛟桥园', area: '北区', lng: 115.853042, lat: 28.746592, type: '学院',   tags: ['学院楼'], votes: 0, rating: 3 },
  { id: 'jq_hwky',    name: '海文考研',       campus: '蛟桥园', area: '北区', lng: 115.853414, lat: 28.746973, type: '商店',   tags: ['培训'], votes: 0, rating: 3 },
  { id: 'jq_tw',      name: '北区图文楼',     campus: '蛟桥园', area: '北区', lng: 115.854928, lat: 28.747405, type: '教学楼', tags: ['图书馆', '自习'], votes: 0, rating: 5 },
  { id: 'jq_zhzl',    name: '综合治理办公室', campus: '蛟桥园', area: '北区', lng: 115.855603, lat: 28.747632, type: '行政',   tags: ['办公'], votes: 0, rating: 3 },
  { id: 'jq_xyy',     name: '校医院',         campus: '蛟桥园', area: '北区', lng: 115.853820, lat: 28.749272, type: '医疗',   tags: ['看病', '医保'], votes: 0, rating: 4 },
  { id: 'jq_yjsy',    name: '研究生院',       campus: '蛟桥园', area: '北区', lng: 115.855045, lat: 28.749619, type: '行政',   tags: ['研究生'], votes: 0, rating: 3 },
  { id: 'jq_ysl',     name: '北区影视楼',     campus: '蛟桥园', area: '北区', lng: 115.855834, lat: 28.749781, type: '教学楼', tags: ['上课'], votes: 0, rating: 3 },
  { id: 'jq_yy',      name: '北区游泳馆',     campus: '蛟桥园', area: '北区', lng: 115.855857, lat: 28.749515, type: '体育',   tags: ['游泳'], votes: 0, rating: 4 },
  { id: 'jq_tyg',     name: '蛟桥体育馆',     campus: '蛟桥园', area: '北区', lng: 115.856523, lat: 28.749263, type: '体育',   tags: ['运动'], votes: 0, rating: 4 },
  { id: 'jq_csgg',    name: '财税与公共管理学院', campus: '蛟桥园', area: '北区', lng: 115.857354, lat: 28.745018, type: '学院', tags: ['学院楼'], votes: 0, rating: 4 },
  { id: 'jq_kjxy',    name: '会计学院',       campus: '蛟桥园', area: '北区', lng: 115.856473, lat: 28.745868, type: '学院',   tags: ['学院楼'], votes: 0, rating: 4 },
  { id: 'jq_dlt',     name: '蛟桥大礼堂',     campus: '蛟桥园', area: '北区', lng: 115.857323, lat: 28.746859, type: '礼堂',   tags: ['活动'], votes: 0, rating: 4 },
  { id: 'jq_yt',      name: '圆通速递',       campus: '蛟桥园', area: '北区', lng: 115.857407, lat: 28.746114, type: '快递',   tags: ['取快递'], votes: 0, rating: 3 },
  { id: 'jq_ydc',     name: '北区运动场',     campus: '蛟桥园', area: '北区', lng: 115.857637, lat: 28.748015, type: '体育',   tags: ['运动', '跑步'], votes: 0, rating: 4 },
  { id: 'jq_sjkx',    name: '数据科技协同创新中心', campus: '蛟桥园', area: '北区', lng: 115.852744, lat: 28.743775, type: '其他', tags: ['科研'], votes: 0, rating: 3 },

  /* ============ 枫林园校区（保留旧点位，新数据未覆盖） ============ */
  { id: 'stf-fl', name: '枫林食堂',       campus: '枫林园', lng: 115.837025, lat: 28.732225, type: '食堂', tags: ['小碗菜', '出餐快'], votes: 0, rating: 4.0 },
  { id: 'ws-fl',  name: '枫林卫生所',     campus: '枫林园', lng: 115.83580,  lat: 28.73290,  type: '医疗', tags: ['门诊', '转诊'], votes: 0, rating: 3.9 },
  { id: 'ss-fl',  name: '枫林学生公寓',   campus: '枫林园', lng: 115.83650,  lat: 28.73350,  type: '宿舍', tags: ['住宿'], votes: 0, rating: 3.8 },
  { id: 'kd-fl',  name: '枫林快递服务中心', campus: '枫林园', lng: 115.83500,  lat: 28.73320,  type: '商店', tags: ['快递'], votes: 0, rating: 4.1 }
];

/* ---------- 周边 POI（campus 记为 '周边'） ---------- */
window.surroundingSpots = [
  { id: 'sur-h1', name: '南昌大学第一附属医院', campus: '周边', lng: 115.8830, lat: 28.7440, type: '医疗', tags: ['三甲', '急诊24小时'], votes: 0, rating: 4.7 },
  { id: 'sur-h2', name: '蛟桥镇社区卫生服务中心', campus: '周边', lng: 115.8512, lat: 28.7485, type: '医疗', tags: ['就近', '营业至20点'], votes: 0, rating: 4.0 },
  { id: 'sur-p1', name: '昌盛大药房（双港店）', campus: '周边', lng: 115.8518, lat: 28.7470, type: '商店', tags: ['药店'], votes: 0, rating: 4.1 },
  { id: 'sur-p2', name: '24小时药店（北门店）', campus: '周边', lng: 115.8530, lat: 28.7498, type: '商店', tags: ['药店', '24小时'], votes: 0, rating: 4.3 },
  { id: 'sur-r1', name: '双港美食街', campus: '周边', lng: 115.8605, lat: 28.7430, type: '饭店', tags: ['聚餐'], votes: 0, rating: 4.2 },
  { id: 'sur-s1', name: '旺中旺超市（双港店）', campus: '周边', lng: 115.8590, lat: 28.7452, type: '商店', tags: ['超市'], votes: 0, rating: 4.0 },
  { id: 'sur-h3', name: '麦庐社区卫生服务站', campus: '周边', lng: 115.8190, lat: 28.7255, type: '医疗', tags: ['麦庐就近'], votes: 0, rating: 3.9 },
  { id: 'sur-r2', name: '玉屏大道餐馆一条街', campus: '周边', lng: 115.8135, lat: 28.7260, type: '饭店', tags: ['麦庐就近'], votes: 0, rating: 4.1 },
  { id: 'sur-h4', name: '枫林大道诊所', campus: '周边', lng: 115.8385, lat: 28.7340, type: '医疗', tags: ['营业至21点'], votes: 0, rating: 3.8 },
  { id: 'sur-s2', name: '双港水果超市', campus: '周边', lng: 115.8525, lat: 28.7462, type: '商店', tags: ['水果', '生鲜'], votes: 0, rating: 3.9 }
];

/* ---------- 点位别名注入（AI 模糊匹配用，精确匹配优先于模糊匹配） ---------- */
(function () {
  var ALIASES = {
    /* 麦庐南 */
    'ml_xgxy': ['信管学院'], 'ml_ysxy': ['艺术学院'], 'ml_glxy': ['数智学院'],
    'ml_jsjxy': ['计智学院', '计算机学院'], 'ml_fxy': ['法学院'], 'ml_wgyxy': ['外语学院'],
    'ml_tyxy': ['体经中心'], 'ml_tyg': ['麦庐体育馆'], 'ml_ydc': ['麦庐操场'],
    'ml_j1': ['麦庐一教'], 'ml_j2': ['麦庐二教'], 'ml_dlt': ['麦庐大礼堂'],
    'ml_dshd': ['麦庐大活'], 'ml_nanmen': ['麦庐南门'],
    'ml_yst': ['一食堂', '麦庐一食堂'], 'ml_est': ['二食堂', '麦庐二食堂'],
    'ml_sf': ['顺丰'], 'ml_cn': ['菜鸟'], 'ml_yz': ['邮政'], 'ml_kdyz': [],
    'ml_jla': ['静庐'], 'ml_jlb': [], 'ml_jlc': [], 'ml_jld': [], 'ml_jle': [], 'ml_m6': [],
    /* 麦庐北 */
    'ml_gsglxy': ['工商学院'], 'ml_bqst': ['三食堂', '麦庐三食堂'], 'ml_bmen': ['麦庐北门'], 'ml_bnm': [],
    /* 蛟桥南 */
    'jq_dshd': ['大活', '蛟桥大活'], 'jq_zzzx': ['资助中心', '学工处', '学生资助管理科'],
    'jq_nqst': ['蛟桥南食堂'], 'jq_xdf': ['新东方'], 'jq_nqj1': ['蛟桥一教'],
    'jq_sjjx': ['计算机中心'], 'jq_mmyz': ['妈妈驿站'], 'jq_nqbg': [],
    'jq_gjjl': ['国际处'], 'jq_nm': [],
    /* 蛟桥北 */
    'jq_gsyh': ['工行'], 'jq_gwc': ['购物广场'], 'jq_yz': ['邮政'],
    'jq_bm': [], 'jq_kjsxy': [], 'jq_spm': ['税票博物馆'], 'jq_yd': ['移动营业厅'],
    'jq_bqbg': [], 'jq_gh': ['工会'], 'jq_bqst': ['蛟桥北食堂'],
    'jq_hwjy': ['海外学院'], 'jq_hwky': [], 'jq_tw': ['图文楼', '图书馆', '自习'],
    'jq_zhzl': ['综治办'], 'jq_xyy': ['校医院', '蛟桥校医院'], 'jq_yjsy': ['研究生院'],
    'jq_ysl': ['影视楼'], 'jq_yy': ['游泳馆'], 'jq_tyg': ['蛟桥体育馆'],
    'jq_csgg': ['财税学院'], 'jq_kjxy': ['会计学院'], 'jq_dlt': ['大礼堂'],
    'jq_yt': ['圆通'], 'jq_ydc': ['蛟桥操场', '运动场'], 'jq_sjkx': ['数据中心'],
    /* 枫林 */
    'stf-fl': ['枫林食堂'], 'ws-fl': ['枫林卫生所', '枫林医务室'], 'ss-fl': ['枫林宿舍'], 'kd-fl': ['快递中心', '枫林快递']
  };
  spots.forEach(function (s) { s.aliases = ALIASES[s.id] || []; });
  var SALIASES = {
    'sur-h1': ['南大一附院', '一附院'], 'sur-h2': ['蛟桥社区医院', '社区卫生服务中心'],
    'sur-p1': ['昌盛大药房'], 'sur-p2': ['北门店', '24小时药店'],
    'sur-r1': ['美食街', '双港美食'], 'sur-s1': ['旺中旺', '双港超市'],
    'sur-h3': ['麦庐卫生站'], 'sur-r2': ['玉屏餐馆', '餐馆一条街'],
    'sur-h4': ['枫林诊所'], 'sur-s2': ['水果超市', '双港水果']
  };
  surroundingSpots.forEach(function (s) { s.aliases = SALIASES[s.id] || []; });
})();

/* ---------- 办事流程（V6.6 整合版，id 已全部映射到新点位） ---------- */
window.workflows = [
  {
    id: 'wf-card', title: '补办学生证（每月15日/30日受理）', campusScope: 'single', estimatedMinutes: 40,
    relatedSpotIds: ['jq_dshd'],
    steps: [
      { text: '【遗失补办】先向学院递交补办申请，注明姓名、性别、学号、院系专业、班级、出生年月、籍贯、身份证号、家庭住址、乘车区间，学院签署意见并盖章', minutes: 15, campus: '蛟桥园' },
      { text: '【换办（破损/转专业）】凭旧证直接到学生管理科办理，无需学院申请', minutes: 5, campus: '蛟桥园' },
      { text: '【办理地点】学工处学生管理科（南区大学生活动中心二楼203室），受理时间：每月15日和30日', minutes: 20, spotId: 'jq_dshd', campus: '蛟桥园' },
      { text: '【火车优惠卡】补证后满六个月才可购买张贴火车票优惠卡', minutes: 0, campus: '蛟桥园' }
    ],
    note: '受理时间：每月 15 日、30 日（节假日顺延）'
  },
  {
    id: 'wf-yibao', title: '住院医保报销材料提交（两校区均可）', campusScope: 'cross', estimatedMinutes: 45,
    relatedSpotIds: ['jq_xyy', 'ml_dshd'],
    steps: [
      { text: '按 1-12 号顺序整理装订：发票原件、费用总清单（只收总清单）、出院小结、诊断书、学生证/身份证复印件、银行卡复印件（注明开户网点）、证明书', minutes: 15, campus: '自备材料' },
      { spotId: 'jq_xyy', text: '蛟桥园：交到校医院一楼医保办（正常上班时间），每周由学校统一报市医保处', minutes: 30, campus: '蛟桥园' },
      { spotId: 'ml_dshd', text: '麦庐园：每周四下午到大学生活动中心 D102 提交（节假日除外）', minutes: 15, campus: '麦庐园' }
    ]
  },
  {
    id: 'wf-loss', title: '校园卡挂失与补办', campusScope: 'single', estimatedMinutes: 20,
    relatedSpotIds: ['jq_gsyh', 'jq_zhzl'],
    steps: [
      { spotId: 'jq_gsyh', text: '到中国工商银行网点办理挂失、补办新卡（带身份证）', minutes: 15, campus: '蛟桥园' },
      { spotId: 'jq_zhzl', text: '如涉及盗刷或校内意外，到综合治理办公室登记备案', minutes: 5, campus: '蛟桥园' }
    ]
  },
  {
    id: 'wf-score', title: '成绩单打印与成绩复核', campusScope: 'single', estimatedMinutes: 25,
    relatedSpotIds: ['jq_nqbg', 'jq_tw'],
    steps: [
      { spotId: 'jq_nqbg', text: '成绩有疑问先到南区综合办公楼教务处信息科（83816097）咨询或提交书面复核申请', minutes: 10, campus: '蛟桥园' },
      { spotId: 'jq_tw', text: '到图文楼自助打印成绩单；留学用翻译件携两证原件到信息科人工打印', minutes: 15, campus: '蛟桥园' }
    ]
  },
  {
    id: 'wf-fuxiu', title: '辅修缴费注册（缴费在蛟桥，上课多校区）', campusScope: 'cross', estimatedMinutes: 35,
    relatedSpotIds: ['jq_nqbg', 'ml_dshd'],
    steps: [
      { spotId: 'jq_nqbg', text: '每学年开学前三周到南区综合办公楼财务窗口缴费注册，逾期无考试资格', minutes: 20, campus: '蛟桥园' },
      { spotId: 'ml_dshd', text: '凭缴费凭证确认注册状态；暑期辅修课程在麦庐大活线上/线下进行', minutes: 15, campus: '麦庐园' }
    ]
  },
  {
    id: 'wf-cross', title: '跨校区学籍事务一日办', campusScope: 'cross', estimatedMinutes: 90,
    relatedSpotIds: ['jq_nqbg', 'ml_j1'],
    steps: [
      { spotId: 'jq_nqbg', text: '上午先在蛟桥园南区综合办公楼办理主流程（学籍/成绩/证明）', minutes: 40, campus: '蛟桥园' },
      { text: '跨校区通勤（校车/公交约 30-40 分钟，请预留时间）', minutes: 35, campus: '🔀 跨校区' },
      { spotId: 'ml_j1', text: '下午到麦庐园一教学楼教务办办理剩余事项', minutes: 15, campus: '麦庐园' }
    ]
  },
  {
    id: 'wf-visitor', title: '访客进校预约', campusScope: 'cross', estimatedMinutes: 15,
    relatedSpotIds: ['ml_nanmen', 'ml_bmen', 'jq_nm', 'jq_bm'],
    steps: [
      { text: '【预约入口】微信搜索并关注"智慧江财"服务号，点击"入校访客预约"栏目', minutes: 5, campus: '线上办理' },
      { text: '【填写信息】由校内师生代为预约，或访客自行完成预约（填写姓名、身份证、手机号、来访事由、被访人信息）', minutes: 5, campus: '线上办理' },
      { text: '【审批入校】被访人/所在部门审批通过后，访客凭身份证或预约二维码在门岗核验入校', minutes: 5, campus: '🔀 跨校区' }
    ],
    note: '试运行问题联系保卫处：0791-83850331'
  }
];

/* ---------- 高频问题（33条，id 已全部映射到新点位） ---------- */
/* 判定规则：relatedSpotIds 涉及两个及以上校区，或办事路径本身需要跨校区的，标 'cross' */
window.hotQuestions = [
  /* 医保报销（6） */
  { id: 'q1', question: '住院报销要交哪些材料？', answer: '按 1-12 号顺序整理装订：①证明书（校医保办出具）②住院发票原件 ③费用总清单原件（只收总清单，日清单不受理）④出院小结原件 ⑤疾病诊断证明书原件 ⑥学生证复印件 ⑦身份证复印件（正反面）⑧银行卡复印件（注明开户网点）⑨《意外事故核定表》（意外情形）⑩《转诊（异地）申请表》一式两份（南昌以外住院）。发票姓名须与身份证一致。', category: '医保报销', relatedSpotIds: ['jq_xyy', 'ml_dshd'], searchCount: 0, isSensitive: false, campusScope: 'cross', tags: ['报销', '材料', '住院'] },
  { id: 'q2', question: '门诊看病怎么报销？', answer: '凭校园一卡通或社保卡到校医院（含各校区医务室）刷卡就诊，补助部分直接记账，无需事后报销。经校医院同意转诊到校外定点医院的，先自付，凭发票、转诊单、病历、药品清单到校医保办审核报销。', category: '医保报销', relatedSpotIds: ['jq_xyy'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['门诊', '校医院', '一卡通'] },
  { id: 'q3', question: '医保卡丢了怎么办？', answer: '先打 12333 或到社保卡服务窗口挂失（金融账户按银行规定另挂失），再持身份证原件补卡（费用以最新政策为准）。在校期间也可先用一卡通在校医院看门诊；住院报销可请学校出具未持卡证明走手工流程。麦庐同学可周四下午到大活 D102 咨询。', category: '医保报销', relatedSpotIds: ['jq_xyy', 'ml_dshd'], searchCount: 0, isSensitive: false, campusScope: 'cross', tags: ['挂失', '补卡', '社保卡'] },
  { id: 'q4', question: '意外受伤住院怎么认定？', answer: '需填写《南昌市基本医疗保险意外事故核定表》：校内意外由保卫处或学院鉴定盖章；校外由交管部门或公安部门盖章；实习期间由实习单位盖章；假期在家由社区或街道盖章。填写时叙述要详尽（时间、地点、人物、经过）。', category: '医保报销', relatedSpotIds: ['jq_xyy', 'jq_zhzl'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['意外', '核定表', '盖章'] },
  { id: 'q5', question: '暑假在家住院能报销吗？', answer: '可以。寒暑假期间可直接在当地医保定点医院住院，费用先自付；治疗结束后 45 日内（部分年份文件为 60 天，以当年通知为准）回学校报销。非寒暑假需先在校医保办办理转诊/备案手续，未备案的按起付 800 元、政策范围内 35% 支付。', category: '医保报销', relatedSpotIds: ['jq_xyy'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['异地', '暑假', '住院'] },
  { id: 'q6', question: '学平险和商业保险怎么报？', answer: '学校商业保险（入学时自愿购买）报销两部分：①意外伤害门诊费用；②住院费用先经居民医保报销后，剩余部分再申请商保补充。材料：发票、病历、检查报告、身份证/学生证复印件、银行卡复印件、保险单据、理赔申请书（校医院代发）。一般 3-6 个月到账。', category: '医保报销', relatedSpotIds: ['jq_xyy'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['学平险', '商保', '理赔'] },
  /* 办事流程（8） */
  { id: 'q7', question: '补办学生证的流程是什么？', answer: '【受理时间】每月 15 日和 30 日。\n①遗失补办：先向学院递交补办申请（注明姓名、性别、学号、院系专业、班级、出生年月、籍贯、身份证号、家庭住址、乘车区间），学院签署意见并盖章；\n②换办（破损/转专业）：凭旧证直接到学生管理科办理；\n③办理地点：学工处学生管理科（南区大学生活动中心二楼 203 室）；\n④火车优惠卡：补证后满六个月才可购买张贴。', category: '办事流程', relatedSpotIds: ['jq_dshd'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['学生证', '补办', '学工处'] },
  { id: 'q8', question: '校园卡丢了去哪补办？', answer: '先到附近银行网点办理挂失、补办新卡，需带身份证；如涉及盗刷，同时到综合治理办公室登记备案。一卡通丢失期间食堂消费可用其他支付方式。', category: '办事流程', relatedSpotIds: ['jq_gsyh', 'jq_zhzl'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['校园卡', '一卡通', '挂失'] },
  { id: 'q9', question: '成绩单打印与成绩复查去哪？', answer: '打印：图文楼自助机（带一卡通）；留学用翻译件需携毕业证、学位证原件到教务处信息科人工打印。复查：对成绩有疑问，开学后按通知时限向课程所在学院提交书面申请（成绩调整仅限登分累分错误及漏改），逾期不受理。咨询 83816097。', category: '办事流程', relatedSpotIds: ['jq_nqbg', 'jq_tw'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['成绩单', '成绩复查', '打印'] },
  { id: 'q10', question: '四六级考试怎么报名？', answer: '在 CET 全国网上报名网站 cet-bm.neea.edu.cn 注册报名，流程：注册→登录→资格验证→笔试缴费→口试缴费→报名成功，注册后 24 小时内须缴费。报名条件：修完四级课程可报 CET4，CET4≥425 且修完六级课程可报 CET6，四六级不同批次报名。咨询教务处 83816509。', category: '办事流程', relatedSpotIds: ['jq_nqbg'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['四六级', 'CET', '报名'] },
  { id: 'q11', question: '辅修专业怎么缴费注册？', answer: '每学年开学前三周到财务窗口缴费注册（逾期无考试资格），凭缴费凭证到教务处确认注册状态；想退读的，开学后前三周到教务处网站下载《退读辅修专业申请表》，签字盖章后交教务处运行科。辅修课程多安排在麦庐大活，注意跨校区通勤。', category: '办事流程', relatedSpotIds: ['jq_nqbg', 'ml_dshd'], searchCount: 0, isSensitive: false, campusScope: 'cross', tags: ['辅修', '缴费', '财务处'] },
  { id: 'q12', question: '跨校区办事一天怎么跑最顺？', answer: '建议顺序：上午先在蛟桥园办主流程（教务处/财务处/校医院集中在北区），午饭后乘校车或公交前往麦庐园（约 30-40 分钟），下午到麦庐教务办或大学生活动中心办理剩余事项。枫林园事务量小，可单独安排。跨校区办事请预留充足通勤时间。', category: '办事流程', relatedSpotIds: ['jq_nqbg', 'ml_j1', 'ss-fl'], searchCount: 0, isSensitive: false, campusScope: 'cross', tags: ['跨校区', '通勤', '路线'] },
  { id: 'q13', question: '麦庐校区的同学交医保材料去哪？', answer: '两个选择：①每周四下午到麦庐大学生活动中心 D102 提交；②其他时间到蛟桥园校医院一楼医保办提交。材料要求相同（发票原件、总清单、出院小结、诊断书、学生证/身份证复印件、银行卡复印件等），报销款约 3-6 个月到账至本人银行卡。', category: '办事流程', relatedSpotIds: ['ml_dshd', 'jq_xyy'], searchCount: 0, isSensitive: false, campusScope: 'cross', tags: ['麦庐', '医保', '交材料'] },
  { id: 'q14', question: '学生证火车票优惠怎么充磁？', answer: '每学年开学时以班级为单位统一充磁/核验，具体由学院教务办组织；错过统一办理的，可到学院教务办或学生管理科咨询补办。学生证乘车区间须与家庭住址一致。', category: '办事流程', relatedSpotIds: ['jq_dshd'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['火车票', '充磁', '优惠'] },
  /* 校园生活（8） */
  { id: 'q15', question: '哪个食堂性价比高？', answer: '麦庐园一食堂人均约 10 元性价比最高；蛟桥园南区食堂早餐最丰富，北区食堂午市排队较长。三食堂有清真窗口。可在地图上查看各食堂实时支持率再做决定。', category: '校园生活', relatedSpotIds: ['ml_yst', 'ml_est', 'ml_bqst', 'jq_nqst', 'jq_bqst'], searchCount: 0, isSensitive: false, campusScope: 'cross', tags: ['食堂', '性价比', '吃饭'] },
  { id: 'q16', question: '麦庐园食堂在哪？', answer: '一食堂位于麦庐园南区静庐宿舍区旁，二食堂位于 6 号门附近，三食堂位于北区。供餐时间 6:30-13:00 / 16:30-19:30。校外玉屏大道还有餐馆一条街可作为闭餐后的备选。', category: '校园生活', relatedSpotIds: ['ml_yst', 'ml_est', 'ml_bqst'], searchCount: 0, isSensitive: false, campusScope: 'cross', tags: ['麦庐', '食堂', '位置'] },
  { id: 'q17', question: '校医院几点下班？', answer: '蛟桥园校医院（北区）门诊时间 8:30-11:30 / 14:00-17:00，医保办同时间受理报销材料；17:00 后急诊可去南昌大学第一附属医院（24 小时）或蛟桥镇社区卫生服务中心（营业至 20:00）。麦庐医保材料受理为每周四下午。', category: '校园生活', relatedSpotIds: ['jq_xyy'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['校医院', '下班', '营业时间'] },
  { id: 'q18', question: '枫林园有医务室吗？', answer: '有，枫林卫生所位于枫林园校区内，门诊时间 8:30-11:30 / 14:00-17:00，可处理日常常见病并开具转诊单。下班后可去枫林大道诊所（营业至 21:00）。', category: '校园生活', relatedSpotIds: ['ws-fl'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['枫林', '医务室', '卫生所'] },
  { id: 'q19', question: '快递去哪取？', answer: '麦庐园快递点集中在二食堂附近（顺丰、菜鸟、邮政、快递驿站）；蛟桥园南区有妈妈驿站，北区有邮政和圆通；枫林快递服务中心是各快递集中收发点。毕业寄件可在快递点直接办理。', category: '校园生活', relatedSpotIds: ['ml_sf', 'ml_cn', 'ml_yz', 'jq_mmyz', 'jq_yz', 'jq_yt', 'kd-fl'], searchCount: 0, isSensitive: false, campusScope: 'cross', tags: ['快递', '取件'] },
  { id: 'q20', question: '图书馆几点开门？', answer: '蛟桥园北区图文楼 7:30-22:00 开放（自习、借阅、成绩单自助打印）；麦庐园可在教学楼或大学生活动中心自习。考试周会延长或加开自习区，以馆内通知为准。', category: '校园生活', relatedSpotIds: ['jq_tw'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['图书馆', '自习', '开门'] },
  { id: 'q21', question: '运动场对外开放吗？', answer: '北区运动场主要供校内师生使用，早晚跑步、球类活动均可，具体开放时段以体育学院通知为准；大型赛事期间会临时封闭。麦庐园运动场在静庐宿舍区东侧。', category: '校园生活', relatedSpotIds: ['jq_ydc', 'ml_ydc'], searchCount: 0, isSensitive: false, campusScope: 'cross', tags: ['运动场', '跑步', '锻炼'] },
  { id: 'q22', question: '宿舍报修找谁？', answer: '宿舍水电门窗损坏，先找宿管登记，紧急情况（漏水、漏电）直接报保卫处或后勤值班电话；麦庐、枫林校区报修路径相同。报修后保留报修单号便于跟进。', category: '校园生活', relatedSpotIds: ['jq_zhzl'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['报修', '宿舍', '后勤'] },
  /* 学业考试（6） */
  { id: 'q23', question: '期末考试一般在什么时候？', answer: '以 252 学期校历为例：期末考试为 2026 年 6 月 29 日至 7 月 5 日（院考 6 月 22 日-28 日）。考试安排考前可在教务系统查询并打印考试通知单；缓考需在截止日期前向学院申请并报教务处。', category: '学业考试', relatedSpotIds: ['jq_nqbg'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['期末', '考试', '时间'] },
  { id: 'q24', question: '挂科了补考在什么时候？', answer: '补考一般安排在开学初（以当年通知为准），需在规定时间内在教务系统报名，逾期不予补报。实践实验类、英语听说类课程必须重修不能补考，违纪课程无补考资格。', category: '学业考试', relatedSpotIds: ['jq_nqbg'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['补考', '重修', '挂科'] },
  { id: 'q25', question: '转专业考试怎么准备？', answer: '转专业大类考试通常每学年一次（参考往年 6 月），报名后按接收学院公布的科目备考，重点复习数学与英语基础；录取看笔试+绩点综合。报名了但无法参加的，留意学院通知的补考安排。', category: '学业考试', relatedSpotIds: ['jq_nqbg'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['转专业', '考试'] },
  { id: 'q26', question: '评教入口在哪里？', answer: '从学校主页→数字校园→本科教学评教系统进入（校园网内网），账号为一卡通号，建议用谷歌/火狐/360 极速模式浏览器，勿用 IE。不按时评教会取消学分制系统查询权利。评教需所有课程都提交才算完成。', category: '学业考试', relatedSpotIds: ['jq_nqbg'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['评教', '入口'] },
  { id: 'q27', question: '毕业证、学位证什么时候发？', answer: '第一批证书一般 6 月底发放，后续符合资格的由学院统一领取（不针对个人发放）。需证书翻译件的，携两证原件到教务处信息科人工打印。毕业前请确认学费、图书、校园卡无欠费。', category: '学业考试', relatedSpotIds: ['jq_nqbg'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['毕业证', '学位证', '领取'] },
  { id: 'q28', question: '缓考怎么申请？', answer: '因病或不可抗力无法参加考试，需在考试前向所在学院提交书面申请（因病附医院证明），经班主任、学院书记签字后报教务处运行科；获批后成绩按缓考记载，随补考一起安排。考试后一般不再受理。', category: '学业考试', relatedSpotIds: ['jq_nqbg'], searchCount: 0, isSensitive: false, campusScope: 'single', tags: ['缓考', '申请'] },
  /* 心理关怀（4，Base64 加密，isSensitive=true） */
  { id: 'q29', question: '最近压力很大，学校有心理咨询吗？', answer: '5pyJ55qE44CC4pGg5a2m5qCh5b+D55CG5YGl5bq35pWZ6IKy5LiO5ZKo6K+i5Lit5b+D5o+Q5L6b5YWN6LS544CB5L+d5a+G55qE5Liq5L2T5ZKo6K+i77yM6aKE57qm5pa55byP6KeB5a2m55Sf5omL5YaM5oiW55u05o6l6K+i6Zeu6L6F5a+85ZGY77yb4pGh5oOF57uq5oCl5pWR5Y+v5ouo5omT5YWo5Zu9MjTlsI/ml7blv4PnkIbmj7Tliqnng63nur8xMjM1Nu+8m+KRouWmguaenOmcgOimge+8jOagoeWMu+mZouWPr+W8gOWFt+i9rOiviuWNlei9rOiHs+axn+ilv+ecgeeyvuelnuWNq+eUn+S4reW/g++8iOWNl+aYjOW4guS4iuWdiui3rzQy5Y+377yJ44CC5rGC5Yqp5LiN5piv6L2v5byx77yM5piv5YC85b6X6IKv5a6a55qE6Ieq5oiR54Wn6aG+44CC', category: '心理关怀', relatedSpotIds: ['jq_xyy'], searchCount: 0, isSensitive: true, campusScope: 'single', tags: ['心理', '压力', '咨询'] },
  { id: 'q30', question: '抑郁情绪持续两周了怎么办？', answer: '5bu66K6u5oyJ5LiJ5q2l6LWw77ya4pGh5YWI6IGU57O75a2m5qCh5b+D55CG5YGl5bq35pWZ6IKy5LiO5ZKo6K+i5Lit5b+D5YGa5YWN6LS56K+E5Lyw77yI6YCU5b6E6KeB5a2m55Sf5omL5YaM5oiW6L6F5a+85ZGY77yJ77yb4pGh6Iul5oyB57ut5Lik5ZGo5Lul5LiK5LiU5b2x5ZON5L2c5oGv5a2m5Lmg77yM6K+35bC95b+r5Yiw5LiT56eR5Yy76Zmi5bCx6K+K77yM5qCh5Yy76Zmi5Y+v5byA6L2s6K+K5Y2V77yM5rGf6KW/55yB57K+56We5Y2r55Sf5Lit5b+D5Zyw5Z2A77ya5Y2X5piM5biC5LiK5Z2K6LevNDLlj7fvvJvikaLntKfmgKXlhrLliqjml7bnq4vljbPmi6jmiZMxMjM1NuaIluWRiuefpei6q+i+ueWPr+S/oeeahOS6uuOAguS9oOS4jemcgOimgeeLrOiHquaJm+i/h+WOu+OAgg==', category: '心理关怀', relatedSpotIds: ['jq_xyy'], searchCount: 0, isSensitive: true, campusScope: 'single', tags: ['抑郁', '情绪', '心理'] },
  { id: 'q31', question: '失眠严重，该不该去看医生？', answer: '6K+l55yL44CC6Lev5b6E77ya4pGh5YWI5Yiw5qCh5Yy76Zmi77yI6Juf5qGl5Zut5YyX5Yy677yJ5o6S5p+l6Lqv5L2T5Zug57Sg77yb4pGh552h55yg6Zeu6aKY5oyB57ut5b2x5ZON55m95aSp54q25oCB77yM6L2s5LuL5a2m5qCh5b+D55CG5YGl5bq35pWZ6IKy5LiO5ZKo6K+i5Lit5b+D77yb4pGi5b+F6KaB5pe25LiT56eR5Yy76Zmi552h55ygL+W/g+eQhumXqOiviuOAguedoeWJjeS4gOWwj+aXtui/nOemu+Wxj+W5leOAgeWbuuWumui1t+W6iuaXtumXtO+8jOavlOWKqeecoOiNr+eJqeabtOWPr+aMgee7reOAgg==', category: '心理关怀', relatedSpotIds: ['jq_xyy'], searchCount: 0, isSensitive: true, campusScope: 'single', tags: ['失眠', '医生', '睡眠'] },
  { id: 'q32', question: '体检查出异常指标该去哪复查？', answer: '5Yir5oWM77yM5oyJ5qKv5bqm5aSN5p+l77ya4pGg5bim5L2T5qOA5oql5ZGK5Yiw5qCh5Yy76Zmi77yI6Juf5qGl5Zut5YyX5Yy677yJ5Yid6K+K77yM5Yy755Sf5Yik5pat5aSN5p+l6aG555uu77yb4pGh6ZyA6L+b5LiA5q2l5qOA5p+l55qE77yM5Y+v5Zyo5Y2X5piM5biC5Yy75L+d5a6a54K55Yy76Zmi77yI5aaC5Y2X5aSn5LiA6ZmE6Zmi77yJ5bCx6K+K77yM6LS555So5oyJ5aSn5a2m55Sf5Yy75L+d5pS/562W5oql6ZSA77yb4pGi5aSN5p+l57uT6K665raJ5Y+K6ZqQ56eB55qE77yM5Y+q5pyJ5L2g5pys5Lq65pyJ5p2D5p+l6ZiF44CC', category: '心理关怀', relatedSpotIds: ['jq_xyy'], searchCount: 0, isSensitive: true, campusScope: 'single', tags: ['体检', '复查', '医生'] },
  /* 访客预约（1） */
  { id: 'q33', question: '访客怎么预约进校？', answer: '微信搜索并关注"智慧江财"服务号，点击"入校访客预约"栏目，由校内师生代为预约或访客自行完成预约（填写姓名、身份证、手机号、来访事由），被访人审批通过后凭身份证或预约二维码在门岗核验入校。试运行问题联系保卫处：0791-83850331。', category: '办事流程', relatedSpotIds: ['ml_nanmen', 'ml_bmen', 'jq_nm', 'jq_bm'], searchCount: 0, isSensitive: false, campusScope: 'cross', tags: ['访客', '预约', '进校'] }
];

/* ---------- 敏感词表（单独列出方便增删；AI 输入分级过滤 + 本地解密关键词） ---------- */
window.SENSITIVE_KEYWORDS = ['心理', '压力', '抑郁', '焦虑', '失眠', '医保', '报销', '生病', '住院', '情绪'];
window.SENSITIVE_KEY = window.SENSITIVE_KEYWORDS;   // 兼容旧引用（本地知识库解密判断）
window.HIGH_RISK_KEYWORDS = ['自杀', '自残', '杀人', '轻生', '想死', '伤害自己'];

/* ---------- 学习资源彩蛋（V6.1 数据恢复，接口供后续扩充） ---------- */
window.studyResources = [
  { id: 'r1', title: '宋浩老师《高等数学》视频（B站）', type: '高数', url: 'https://www.bilibili.com', description: '全网最火高数入门课，配套同济教材逐章讲解，适合预习与查漏补缺', tags: ['视频课', '免费'] },
  { id: 'r2', title: '同济七版《高等数学》教材配套', type: '高数', url: 'https://www.bilibili.com', description: '官方教材+课后习题全解，考研与期末通用底座', tags: ['教材'] },
  { id: 'r3', title: '高数习题集推荐（李永乐/张宇基础篇）', type: '高数', url: 'https://www.zhihu.com', description: '基础阶段题量足够，错题按"概念不清/计算错误/完全不会"分类整理', tags: ['习题'] },
  { id: 'r4', title: '《新概念英语》1-4册', type: '英语', url: 'https://www.bilibili.com', description: '经典语感教材，第一二册打底，配合音频影子跟读', tags: ['教材', '听说'] },
  { id: 'r5', title: '四六级备考资源（真题+听力）', type: '英语', url: 'https://www.bilibili.com', description: '近10年真题至少两遍，听力精听逐句听写', tags: ['考试'] },
  { id: 'r6', title: '每日英语听力 APP', type: '英语', url: 'https://www.baidu.com', description: '碎片化练听力首选，支持单句循环与跟读打分', tags: ['APP'] },
  { id: 'r7', title: '廖雪峰官方网站（Python/Git 教程）', type: '编程', url: 'https://www.liaoxuefeng.com', description: '中文最友好的入门教程，动手敲完 Git 章节', tags: ['免费', '中文'] },
  { id: 'r8', title: 'LeetCode（力扣）', type: '编程', url: 'https://leetcode.cn', description: '算法刷题平台，面试与竞赛必备，从"简单"标签开始', tags: ['算法'] },
  { id: 'r9', title: 'GitHub', type: '编程', url: 'https://github.com', description: '代码托管与开源社区，课设代码传上去积累作品集', tags: ['工具'] },
  { id: 'r10', title: 'CS-DIY 自学指南', type: '编程', url: 'https://csdiy.wiki', description: '计算机自学路线大全，名校课程索引，方向迷茫时先翻它', tags: ['路线图'] },
  { id: 'r11', title: '知乎', type: '社区', url: 'https://www.zhihu.com', description: '经验贴与择校择业信息，注意甄别广告与软文', tags: ['社区'] },
  { id: 'r12', title: 'CSDN', type: '社区', url: 'https://www.csdn.net', description: '中文技术博客，报错信息搜索首选', tags: ['社区'] },
  { id: 'r13', title: 'Stack Overflow', type: '社区', url: 'https://stackoverflow.com', description: '全球最大程序员问答社区，英文提问前先看高赞答案', tags: ['英文'] },
  { id: 'r14', title: 'Reddit r/learnprogramming', type: '社区', url: 'https://www.reddit.com/r/learnprogramming/', description: '英文编程学习社区，新手提问氛围友好', tags: ['英文', '社区'] }
];

/* ---------- 高频问题增补：无（已合并到上面数组中） ---------- */

/* ---------- V7.3 学校正式文件热更新（模块零-4） ----------
   docUrl：学校正式文件链接（https）；docUpdateTime：ISO 日期。
   docUpdateTime 晚于 localStorage 'zxsj66_doc_seen_<id>' 时，点位名称旁显示未读红点。
   运行时更新走 ZXSJ.updateSchoolDocs(spotId, url, isoTime)（含 https/ISO 校验）。 */
window.SPOT_DOCS = {
  'jq_xyy':  { docUrl: 'https://www.jxufe.edu.cn/', docUpdateTime: '2026-10-10' },   /* 住院报销材料通知 */
  'jq_dshd': { docUrl: 'https://www.jxufe.edu.cn/', docUpdateTime: '2026-10-12' },   /* 学生证补办受理通知 */
  'jq_nqbg': { docUrl: 'https://www.jxufe.edu.cn/', docUpdateTime: '2026-09-28' },   /* 教务处考试安排通知 */
  'jq_tw':   { docUrl: 'https://www.jxufe.edu.cn/', docUpdateTime: '2026-10-08' },   /* 图文楼开放时间调整 */
  'ml_dshd': { docUrl: 'https://www.jxufe.edu.cn/', docUpdateTime: '2026-10-09' }    /* 麦庐医保材料受理安排 */
};

/* ---------- V7.3 楼层信息（模块二-3 剖面查看器数据源，无数据的点位显示"楼层信息待补充"） ---------- */
window.SPOT_FLOORS = {
  'jq_tw':  ['1F 总服务台 / 自助打印区', '2F 社科借阅区', '3F 自科借阅区', '4F 自习区（考试周加开）'],
  'jq_xyy': ['1F 门诊 / 医保办', '2F 检验科 / 观察室', '3F 健康管理中心'],
  'ml_yst': ['1F 大众餐窗口', '2F 风味窗口 / 清真窗口'],
  'ml_est': ['1F 大众餐 / 面点', '2F 特色档口'],
  'ml_bqst':['1F 大众餐', '2F 清真窗口 / 教工餐'],
  'jq_nqst':['1F 早餐（全校区最丰富）', '2F 午晚餐窗口'],
  'jq_bqst':['1F 午市窗口', '2F 风味餐厅'],
  'ml_tyg': ['1F 篮球馆 / 羽毛球馆', '2F 健身房 / 舞蹈房']
};

/* 注入到点位对象（spot.docUrl / docUpdateTime / floors 可被任意模块直接读取） */
(function () {
  spots.forEach(function (s) {
    var d = window.SPOT_DOCS[s.id];
    if (d) { s.docUrl = d.docUrl; s.docUpdateTime = d.docUpdateTime; }
    var f = window.SPOT_FLOORS[s.id];
    if (f) s.floors = f;
  });
})();

/* ============================================================
   V9.0 Loca LinkLayer 六条事务链（主地图连线数据源）
   医保 / 教务 / 学生证 / 奖助 / 报修 / 运动联动。
   全部引用现有 64 点位 id（不可断链，勿改 id）；
   体育类点位以蛟桥/麦庐现有 6 个体育点位补齐联动：
   jq_yy 游泳馆 / jq_tyg 蛟桥体育馆 / jq_ydc 北区运动场 /
   ml_tyxy 体经中心 / ml_tyg 麦庐体育馆 / ml_ydc 麦庐运动场。
   color 供 LinkLayer 逐条着色，label 供图例展示。
   ============================================================ */
window.LINK_EDGES = [
  { id: 'lk-medical',  label: '医保报销',   color: '#46B27A', path: ['jq_xyy', 'jq_dshd', 'ml_dshd'] },
  { id: 'lk-academic', label: '教务成绩',   color: '#5E86D8', path: ['jq_nqbg', 'jq_tw', 'ml_j1'] },
  { id: 'lk-card',     label: '学生证补办', color: '#E0953F', path: ['jq_kjxy', 'jq_dshd', 'jq_tw'] },
  { id: 'lk-award',    label: '奖助学金',   color: '#8A6FD1', path: ['jq_zzzx', 'jq_nqbg', 'jq_gsyh'] },
  { id: 'lk-repair',   label: '宿舍报修',   color: '#D65A72', path: ['ml_jla', 'ml_dshd', 'jq_zhzl'] },
  { id: 'lk-sport',    label: '运动联动',   color: '#3FA8B4', path: ['jq_yy', 'jq_tyg', 'jq_ydc', 'ml_tyg', 'ml_ydc', 'ml_tyxy'] }
];
