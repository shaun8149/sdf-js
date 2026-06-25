// =============================================================================
// atoms-2d/charts/typography/call-to-action.js — Final-slide CTA atom
// -----------------------------------------------------------------------------
// Big heading + supporting subheading + accent button visual + optional contact.
// Full-bleed colored background (accent / dark / light).
//
// Args:
//   heading     — big CTA heading (REQUIRED)
//   subheading? — supporting line
//   buttonText? — button label (default 'Get Started')
//   buttonStyle — 'solid'|'outline'? (default 'solid')
//   contact?    — contact details line (email · website)
//   bg          — 'accent'|'dark'|'light'? (default 'accent')
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'call-to-action',
  category: 'charts/typography',
  description:
    'Final-slide CTA atom — heading, subheading, button visual, optional contact on colored full-bleed background.',
  args: {
    heading: { type: 'string', required: true, example: 'Ready to transform?' },
    subheading: { type: 'string?', example: "Let's talk." },
    buttonText: { type: 'string?', default: "'Get Started'", example: 'Get Started' },
    buttonStyle: { type: "'solid'|'outline'?", default: "'solid'", example: 'solid' },
    contact: { type: 'string?', example: 'hello@acme.com · acme.com' },
    bg: { type: "'accent'|'dark'|'light'?", default: "'accent'", example: 'accent' },
  },
};

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bgPalette = palette.bg || [248, 246, 240];
  const accent = palette.accent || palette.colors?.[0] || [60, 100, 200];

  const bgMode = args.bg || 'accent';
  let panelBg, textColor, subTextColor, btnBg, btnText;

  if (bgMode === 'dark') {
    panelBg = [18, 18, 28];
    textColor = [255, 255, 255];
    subTextColor = [200, 200, 215];
    btnBg = accent;
    btnText = [255, 255, 255];
  } else if (bgMode === 'light') {
    panelBg = bgPalette;
    textColor = fg;
    subTextColor = [
      Math.min(255, fg[0] + 60),
      Math.min(255, fg[1] + 60),
      Math.min(255, fg[2] + 60),
    ];
    btnBg = accent;
    btnText = [255, 255, 255];
  } else {
    // accent (default)
    panelBg = accent;
    textColor = [255, 255, 255];
    subTextColor = [230, 230, 230];
    btnBg = [255, 255, 255];
    btnText = accent;
  }

  // Full-bleed background
  ctx.fillStyle = rgbCss(panelBg);
  ctx.fillRect(x, y, w, h);

  const heading = String(args.heading || '');
  const subheading = args.subheading ? String(args.subheading) : '';
  const buttonText = args.buttonText ? String(args.buttonText) : 'Get Started';
  const contact = args.contact ? String(args.contact) : '';
  const btnStyle = args.buttonStyle || 'solid';

  // Compute layout — vertical centered stack
  const headingFontSize = Math.round(h * 0.17);
  const subFontSize = Math.round(h * 0.07);
  const btnFontSize = 16;
  const btnH = 52;
  const contactFontSize = Math.round(h * 0.034);
  const mtSub = Math.round(h * 0.03);
  const mtBtn = Math.round(h * 0.06);
  const mtContact = Math.round(h * 0.05);

  const hasBtn = Boolean(buttonText);
  const hasSub = Boolean(subheading);
  const hasContact = Boolean(contact);

  let blockH = headingFontSize;
  if (hasSub) blockH += mtSub + subFontSize;
  if (hasBtn) blockH += mtBtn + btnH;
  if (hasContact) blockH += mtContact + contactFontSize;

  let curY = y + (h - blockH) / 2;
  const cx = x + w / 2;

  // Heading
  ctx.save();
  ctx.fillStyle = rgbCss(textColor);
  ctx.font = `900 ${headingFontSize}px "Inter Display", Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const maxHeadW = w - 48;
  ctx.fillText(fitText(ctx, heading, maxHeadW), cx, curY);
  ctx.restore();
  curY += headingFontSize;

  // Subheading
  if (hasSub) {
    curY += mtSub;
    ctx.save();
    ctx.fillStyle = rgbaCss(subTextColor, 0.85);
    ctx.font = `500 ${subFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(fitText(ctx, subheading, maxHeadW), cx, curY);
    ctx.restore();
    curY += subFontSize;
  }

  // Button
  if (hasBtn) {
    curY += mtBtn;
    ctx.save();
    ctx.font = `700 ${btnFontSize}px Inter, system-ui, sans-serif`;
    const btnTextW = ctx.measureText(buttonText).width;
    const btnW = Math.max(btnTextW + 48, 180);
    const btnX = cx - btnW / 2;
    const btnR = btnH / 2;

    if (btnStyle === 'outline') {
      // Outlined button
      ctx.strokeStyle = rgbCss(textColor);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(btnX + btnR, curY);
      ctx.lineTo(btnX + btnW - btnR, curY);
      ctx.arc(btnX + btnW - btnR, curY + btnR, btnR, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(btnX + btnR, curY + btnH);
      ctx.arc(btnX + btnR, curY + btnR, btnR, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = rgbCss(textColor);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(buttonText, cx, curY + btnH / 2);
    } else {
      // Solid button with subtle shadow + pseudo-3D bottom border
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = rgbCss(btnBg);
      ctx.beginPath();
      ctx.moveTo(btnX + btnR, curY);
      ctx.lineTo(btnX + btnW - btnR, curY);
      ctx.arc(btnX + btnW - btnR, curY + btnR, btnR, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(btnX + btnR, curY + btnH);
      ctx.arc(btnX + btnR, curY + btnR, btnR, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 3D-ish bottom border (darker shade)
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      const bdrH = 4;
      ctx.beginPath();
      ctx.moveTo(btnX + btnR, curY + btnH - bdrH);
      ctx.lineTo(btnX + btnW - btnR, curY + btnH - bdrH);
      ctx.arc(btnX + btnW - btnR, curY + btnR, btnR, Math.PI / 2 - 0.1, Math.PI / 2 + 0.1);
      ctx.lineTo(btnX + btnR, curY + btnH);
      ctx.arc(btnX + btnR, curY + btnR, btnR, Math.PI / 2 + 0.1, Math.PI / 2 - 0.1, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = rgbCss(btnText);
      ctx.font = `700 ${btnFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(buttonText, cx, curY + btnH / 2);
      ctx.restore();
    }
    curY += btnH;
  } else {
    ctx.restore();
  }

  // Contact line
  if (hasContact) {
    curY += mtContact;
    ctx.save();
    ctx.fillStyle = rgbaCss(subTextColor, 0.65);
    ctx.font = `500 ${contactFontSize}px "SF Mono", "Fira Code", monospace, Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(fitText(ctx, contact, maxHeadW), cx, curY);
    ctx.restore();
  }
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
