/**
 * 飞入槽位与反馈时长。
 * 飞入物为扑克比例 5:7 的牌面，定位用外接矩形半宽/半高（中心点轨迹减该值得 `translate`）。
 */
export const EP_FLY_DURATION_MS = 420;
export const EP_FLY_ARC_PX = 26;
export const EP_FLY_CARD_W = 50;
export const EP_FLY_CARD_H = Math.round((EP_FLY_CARD_W * 7) / 5);
export const EP_FLY_HALF_W = EP_FLY_CARD_W / 2;
export const EP_FLY_HALF_H = EP_FLY_CARD_H / 2;
