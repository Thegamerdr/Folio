import { describe, expect, it } from 'vitest';

import {
  measureSheetFrame,
  resolveSheetBottomOffset,
  resolveSheetFocusedScroll,
  resolveSheetKeyboardFrame,
  resolveSheetNavigationOffset,
  resolveSheetViewport,
  type SheetWindowFrame,
} from './sheetGeometry';

describe('resolveSheetBottomOffset', () => {
  it('anchors Android portal sheets above the external navigation area', () => {
    expect(
      resolveSheetBottomOffset({
        platform: 'android',
        usesAndroidPortal: true,
        bottomInset: 48,
      }),
    ).toBe(48);
  });

  it('does not shift Android modal or iOS sheets', () => {
    expect(
      resolveSheetBottomOffset({
        platform: 'android',
        usesAndroidPortal: false,
        bottomInset: 48,
      }),
    ).toBe(0);
    expect(
      resolveSheetBottomOffset({ platform: 'ios', usesAndroidPortal: false, bottomInset: 34 }),
    ).toBe(0);
  });

  it('never returns a negative offset', () => {
    expect(
      resolveSheetBottomOffset({
        platform: 'android',
        usesAndroidPortal: true,
        bottomInset: -1,
      }),
    ).toBe(0);
  });
});

describe('native keyboard measurement coordinates', () => {
  function measuredFrame(
    primaryAndroidWindow: boolean,
    root: SheetWindowFrame,
    viewportOffsetY: number,
  ) {
    const frames: SheetWindowFrame[] = [];
    measureSheetFrame(
      {
        measure: (receive) => receive(0, 0, root.width, root.height, root.x, root.y),
        measureInWindow: (receive) =>
          receive(root.x, root.y + viewportOffsetY, root.width, root.height),
      },
      primaryAndroidWindow,
      (frame) => frames.push(frame),
    );
    return frames[0]!;
  }

  it('excludes the changing Android Fabric viewport offset so the whole panel ends at the IME in capture 058', () => {
    const frame = measuredFrame(true, { x: 0, y: 0, width: 360, height: 740 }, -24);
    const viewport = resolveSheetViewport({
      frame,
      keyboard: { screenX: 0, screenY: 441, width: 360, height: 251 },
      topInset: 24,
      bottomOffset: 48,
    });
    expect(frame.y).toBe(0);
    expect(viewport).toMatchObject({ top: 24, bottom: 299, maxHeight: 417 });
    expect(frame.y + frame.height - viewport.bottom).toBe(1323 / 3);
  });

  it('keeps the resting Android panel above the navigation bar when the viewport offset changes back', () => {
    const frame = measuredFrame(true, { x: 0, y: 0, width: 360, height: 740 }, 0);
    const viewport = resolveSheetViewport({ frame, topInset: 24, bottomOffset: 48 });
    expect(frame.y + frame.height - viewport.bottom).toBe(2076 / 3);
  });

  it('preserves measured window coordinates for Modal and iOS presentation', () => {
    expect(measuredFrame(false, { x: 0, y: 0, width: 360, height: 700 }, 40)).toEqual({
      x: 0,
      y: 40,
      width: 360,
      height: 700,
    });
  });

  it('also constrains a full-page form with its own offset without subtracting the keyboard twice', () => {
    const keyboard = { screenX: 0, screenY: 441, width: 360, height: 251 };
    const frame = measuredFrame(true, { x: 24, y: 40, width: 312, height: 576 }, -24);
    const viewport = resolveSheetViewport({
      frame,
      keyboard,
      topInset: 0,
      bottomOffset: 0,
      maxHeightFraction: 1,
    });
    expect(viewport.bottom).toBe(175);
    expect(frame.y + frame.height - viewport.bottom).toBe(keyboard.screenY);
    const resized = { ...frame, height: 401 };
    expect(
      resolveSheetViewport({ frame: resized, keyboard, topInset: 0, bottomOffset: 0 }).bottom,
    ).toBe(0);
  });

  it('ignores an unmounted or not-yet-laid-out native view', () => {
    const frames: SheetWindowFrame[] = [];
    const receive = (frame: SheetWindowFrame) => frames.push(frame);
    measureSheetFrame(null, true, receive);
    measureSheetFrame(
      {
        measure: (callback) => callback(0, 0, 0, 0, 0, 0),
        measureInWindow: (callback) => callback(0, 0, 0, 0),
      },
      true,
      receive,
    );
    expect(frames).toEqual([]);
  });
});

describe('keyboard-constrained sheet viewport', () => {
  const frame = { x: 0, y: 0, width: 360, height: 740 };
  const androidKeyboard = { screenX: 0, screenY: 692, width: 360, height: 251 };

  it('places the whole panel and footer above the actual 1323px keyboard from rendered capture 007', () => {
    const keyboard = resolveSheetKeyboardFrame(androidKeyboard, 35, 740, 48);
    expect(keyboard).toEqual({ ...androidKeyboard, screenY: 441 });
    const viewport = resolveSheetViewport({ frame, keyboard, topInset: 24, bottomOffset: 48 });
    expect(viewport).toEqual({
      top: 24,
      bottom: 299,
      availableHeight: 417,
      maxHeight: 417,
      keyboardOccludesBottom: true,
    });
    expect(frame.height - viewport.bottom).toBe(1323 / 3);
  });

  it('does not subtract keyboard height twice when Android already resized the root', () => {
    const resized = { ...frame, height: 441 };
    const keyboard = resolveSheetKeyboardFrame({ ...androidKeyboard, screenY: 441 }, 35, 740, 48);
    const bottomOffset = resolveSheetNavigationOffset(resized, 740, 48);
    expect(bottomOffset).toBe(0);
    expect(
      resolveSheetViewport({ frame: resized, keyboard, topInset: 24, bottomOffset }),
    ).toMatchObject({ bottom: 0, availableHeight: 417 });
  });

  it('honours a resized legacy Android window even without any keyboard notification', () => {
    const resized = { ...frame, height: 430 };
    expect(
      resolveSheetViewport({
        frame: resized,
        topInset: 24,
        bottomOffset: resolveSheetNavigationOffset(resized, 740, 48),
      }),
    ).toMatchObject({ bottom: 0, availableHeight: 406 });
  });

  it('reserves only the remaining navigation overlap when the root already excludes 24dp', () => {
    const partlyInset = { ...frame, height: 716 };
    const bottomOffset = resolveSheetNavigationOffset(partlyInset, 740, 48);
    expect(bottomOffset).toBe(24);
    const viewport = resolveSheetViewport({ frame: partlyInset, topInset: 24, bottomOffset });
    expect(partlyInset.height - viewport.bottom).toBe(692);
  });

  it('uses the measured window origin for a root below the status bar', () => {
    const belowStatus = { ...frame, y: 24, height: 716 };
    const keyboard = resolveSheetKeyboardFrame(androidKeyboard, 35, 740, 48);
    const viewport = resolveSheetViewport({
      frame: belowStatus,
      keyboard,
      topInset: 24,
      bottomOffset: 48,
    });
    expect(viewport.top).toBe(0);
    expect(belowStatus.y + belowStatus.height - viewport.bottom).toBe(441);
  });

  it('preserves correctly reported legacy Android and iOS keyboard frames', () => {
    const keyboard = { screenX: 0, screenY: 430, width: 360, height: 310 };
    expect(resolveSheetKeyboardFrame(keyboard, 29, 740, 48)).toEqual(keyboard);
    expect(resolveSheetKeyboardFrame(keyboard, null, 740, 34)).toEqual(keyboard);
    expect(resolveSheetViewport({ frame, keyboard, topInset: 44, bottomOffset: 0 })).toMatchObject({
      top: 44,
      bottom: 310,
      availableHeight: 386,
    });
  });

  it('restores the resting safe viewport after keyboard dismissal without retaining its old height', () => {
    expect(resolveSheetKeyboardFrame(undefined, 35, 740, 48)).toBeNull();
    expect(
      resolveSheetViewport({ frame, keyboard: null, topInset: 24, bottomOffset: 48 }),
    ).toMatchObject({
      bottom: 48,
      availableHeight: 668,
      maxHeight: 668,
      keyboardOccludesBottom: false,
    });
  });

  it('does not turn floating or unrelated keyboard windows into a bottom inset', () => {
    const floating = { screenX: 10, screenY: 200, width: 200, height: 200 };
    expect(
      resolveSheetViewport({ frame, keyboard: floating, topInset: 24, bottomOffset: 48 })
        .keyboardOccludesBottom,
    ).toBe(false);
    expect(
      resolveSheetViewport({
        frame,
        keyboard: { ...floating, screenX: 500, height: 540 },
        topInset: 24,
        bottomOffset: 48,
      }).keyboardOccludesBottom,
    ).toBe(false);
  });
});

describe('focused field visibility inside the scroll body', () => {
  it('scrolls the focused field above the footer rather than only above the keyboard', () => {
    expect(
      resolveSheetFocusedScroll({
        scrollY: 0,
        bodyTop: 88,
        bodyHeight: 270,
        inputTop: 320,
        inputHeight: 56,
      }),
    ).toBe(26);
  });
  it('restores a field clipped above the body after a step/layout change', () => {
    expect(
      resolveSheetFocusedScroll({
        scrollY: 200,
        bodyTop: 88,
        bodyHeight: 270,
        inputTop: 60,
        inputHeight: 56,
      }),
    ).toBe(164);
  });
  it('does not move a fully visible field or scroll below zero', () => {
    expect(
      resolveSheetFocusedScroll({
        scrollY: 100,
        bodyTop: 88,
        bodyHeight: 270,
        inputTop: 120,
        inputHeight: 56,
      }),
    ).toBe(100);
    expect(
      resolveSheetFocusedScroll({
        scrollY: 0,
        bodyTop: 88,
        bodyHeight: 270,
        inputTop: 80,
        inputHeight: 56,
      }),
    ).toBe(0);
  });
  it('aligns a multiline field taller than its viewport at the top and ignores unmeasured frames', () => {
    expect(
      resolveSheetFocusedScroll({
        scrollY: 100,
        bodyTop: 88,
        bodyHeight: 60,
        inputTop: 110,
        inputHeight: 120,
      }),
    ).toBe(114);
    expect(
      resolveSheetFocusedScroll({
        scrollY: 100,
        bodyTop: 0,
        bodyHeight: 0,
        inputTop: 110,
        inputHeight: 120,
      }),
    ).toBe(100);
  });
});
