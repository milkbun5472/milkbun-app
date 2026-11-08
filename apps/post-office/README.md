# 邮局小店

小世界第五个入口。宿主 ShopSession 只读全局 `x_stampShop` 与现有 `x_stamps`、CompanionFace.lookFor；不进入旅程/角色房间建档，不写店铺、聊天或记忆，不提供模型调用接口。文字版排班/经营规则仍在 StampDuelPage，所有店面共用同一份数据。

`state.mjs` 把文字版writer的岗位、卡id和装修投影为场景。现实时间从宿主直接调用 StampDuel.shopPeriod，保存的period只用于文字版客人批次。半夜或当天已打烊不显示店员；跨日按文字版原规则沿用排班，3D自己不补写日期。坏档按空店，已删角色/卡跳过。

场景使用现有Three、createRoomKit程序几何、createTraveler/按需衣发、createMapGesture；列车和邮局共用world-renderer的WebGL设置及释放，地图释放沿用disposeMap。没有新GLB/下载贴图，卡面使用邮票册公共StampThumbnails的原缩略图，缺图保留写卡名的纸片。五个装修映射在DECOR_BUILDERS，其余暂不展示；翻新等级保留在投影，第一期不改变模型。

宿主提供公共Head和54–60px底栏及0.4安全区，iframe只有场景和店员名牌。拖动平移、双指缩放、全景复位；真实柜台射线命中/宿主去柜台共用StampNavigation。一次性深链兼容原卡片返回/对局邀请，带fairy-shop的文字版返回进入这家全局店。每2秒及恢复前台重读最新数据；切换销毁RAF/监听/观察器/场景和WebGL上下文。镜头不保存，没有新增存储键。

验证：`node --test test/post-office-world.test.mjs`；`scripts/checks/post-office-browser.cjs`使用干净浏览器、文字版字段构造存档和真实store writer，检查四岗外貌、三卡、五装修、三时段、柜台点击/文字版改班返回、空坏档/删除角色、320/390/430和退出释放。外网拦截、模型/记忆调用计数必须为0，不访问用户真实存档。

客人小人、3D换岗、工牌实体、限定装修/翻新外形属于后期，本期不启用。
