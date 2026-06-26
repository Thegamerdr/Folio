export type Dp = number;
export type HexColor = `#${string}`;
export type Milliseconds = number;

export const folioTokens = {
  color: {
    canvas: '#F7F6F1',
    ink: '#18231D',
    calm: '#2E7D67',
    caution: '#D99A28',
    danger: '#D96D59',
    surface: '#FFFEFB',
    route: {
      shadow: '#C4CAC6',
      payday: '#F0C65B',
      repairGhost: '#D9C6F4',
    },
    role: {
      background: {
        app: '#F7F6F1',
        sunken: '#E9ECE8',
        scrim: '#18231D99',
      },
      surface: {
        base: '#FFFEFB',
        raised: '#FBFAF7',
        selected: '#DDEFE7',
        disabled: '#E9ECE8',
        inverse: '#18231D',
      },
      text: {
        primary: '#18231D',
        secondary: '#4A544D',
        muted: '#69736C',
        inverse: '#FFFFFF',
        link: '#2E7D67',
        danger: '#89483C',
        success: '#2E7D67',
        warning: '#8B6011',
      },
      border: {
        subtle: '#D9DDD8',
        strong: '#8C968F',
        focus: '#2E7D67',
        danger: '#D96D59',
      },
      accent: {
        primary: '#2E7D67',
        primaryStrong: '#1F5F4E',
        primarySoft: '#DDEFE7',
        warm: '#D99A28',
        warmSoft: '#F6E7C2',
        repair: '#D96D59',
        repairSoft: '#F6DDD7',
      },
    },
  },
  typography: {
    family: {
      nativeBody: 'System',
      nativeDisplay: 'System',
      webBody: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      webDisplay: 'Georgia, "Times New Roman", serif',
      numeric: '"SF Mono", "Roboto Mono", ui-monospace, monospace',
      mono: 'ui-monospace, "SF Mono", Consolas, monospace',
    },
    role: {
      caption: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: 500,
        letterSpacing: 0,
      },
      body: {
        fontSize: 16,
        lineHeight: 22,
        fontWeight: 400,
        letterSpacing: 0,
      },
      bodyStrong: {
        fontSize: 16,
        lineHeight: 22,
        fontWeight: 600,
        letterSpacing: 0,
      },
      title: {
        fontSize: 24,
        lineHeight: 30,
        fontWeight: 700,
        letterSpacing: 0,
      },
      display: {
        fontSize: 34,
        lineHeight: 41,
        fontWeight: 700,
        letterSpacing: 0,
      },
      money: {
        fontSize: 28,
        lineHeight: 34,
        fontWeight: 700,
        letterSpacing: 0,
        fontFamilyToken: 'numeric',
        fontVariantNumeric: 'tabular-nums lining-nums',
      },
    },
    policy: {
      supportsDynamicType: true,
      maximumContentSizeMultiplier: 2,
      minimumLineHeightRatio: 1.25,
      doNotClipMoneyValues: true,
    },
  },
  spacing: {
    baseUnit: 4,
    scale: {
      none: 0,
      hairline: 1,
      xxs: 2,
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
      xxxl: 48,
      huge: 64,
    },
    layout: {
      screenInsetCompact: 16,
      screenInsetRegular: 24,
      contentGap: 16,
      sectionGap: 24,
      clusterGap: 8,
    },
  },
  size: {
    touchTarget: 48,
    radius: 8,
    radiusCompact: 4,
    icon: 24,
    focusRingWidth: 3,
  },
  hitTarget: {
    minimumDp: 48,
    minimumSpacingDp: 8,
    expandsInvisibleHitSlop: true,
    policy:
      'Interactive controls must expose at least a 48dp by 48dp visual or invisible hit area.',
    appliesTo: [
      'button',
      'iconButton',
      'listRowAction',
      'switch',
      'checkbox',
      'segmentedControl',
      'calendarCell',
    ],
  },
  interaction: {
    state: {
      focusVisible: {
        outlineColor: '#2E7D67',
        outlineWidth: 3,
        outlineOffset: 2,
        backgroundColor: '#DDEFE7',
        innerContrastRingColor: '#FFFFFF',
      },
      pressed: {
        scale: 0.98,
        opacity: 0.88,
        overlayColor: '#18231D14',
        durationMs: 80,
      },
      disabled: {
        opacity: 0.42,
        contentOpacity: 0.55,
        textColor: '#69736C',
        backgroundColor: '#ECEFE9',
        borderColor: '#D9DDD8',
      },
    },
    policy: {
      preserveLayoutOnStateChange: true,
      focusAlwaysVisibleForKeyboardSwitch: true,
      disabledControlsExposeReasonWhenBlocking: true,
    },
  },
  motion: {
    reducedMotionDurationMs: 0,
    standardDurationMs: 180,
    duration: {
      instant: 0,
      fast: 120,
      standard: 180,
      slow: 240,
    },
    easing: {
      standard: 'cubic-bezier(0.2, 0, 0, 1)',
      emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
    },
    preference: {
      default: {
        durationMs: 180,
        easingToken: 'standard',
        transformAllowed: true,
        decorativeLoopAllowed: false,
      },
      reduce: {
        durationMs: 0,
        easingToken: 'standard',
        transformAllowed: false,
        decorativeLoopAllowed: false,
        replaceAnimatedProgressWithStaticState: true,
      },
    },
  },
  status: {
    neutral: {
      foreground: '#69736C',
      background: '#ECEFE9',
      border: '#D9DDD8',
      affordance: {
        iconName: 'minus-circle',
        label: 'Neutral',
        shape: 'pill',
        pattern: 'outline',
        screenReaderPrefix: 'Neutral status',
      },
    },
    info: {
      foreground: '#2D557D',
      background: '#E8F0FA',
      border: '#7BA1C9',
      affordance: {
        iconName: 'info',
        label: 'Information',
        shape: 'square',
        pattern: 'dot',
        screenReaderPrefix: 'Information status',
      },
    },
    success: {
      foreground: '#2E7D67',
      background: '#DDEFE7',
      border: '#8EC2AD',
      affordance: {
        iconName: 'check-circle',
        label: 'On track',
        shape: 'circle',
        pattern: 'solid',
        screenReaderPrefix: 'On track status',
      },
    },
    warning: {
      foreground: '#8B6011',
      background: '#F6E7C2',
      border: '#D99A28',
      affordance: {
        iconName: 'triangle-alert',
        label: 'Needs attention',
        shape: 'triangle',
        pattern: 'diagonal-stripe',
        screenReaderPrefix: 'Needs attention status',
      },
    },
    danger: {
      foreground: '#89483C',
      background: '#F6DDD7',
      border: '#D96D59',
      affordance: {
        iconName: 'octagon-alert',
        label: 'Action needed',
        shape: 'octagon',
        pattern: 'cross-hatch',
        screenReaderPrefix: 'Action needed status',
      },
    },
  },
  money: {
    text: {
      fontFamilyToken: 'numeric',
      fontVariantNumeric: 'tabular-nums lining-nums',
      fontFeatureSettings: '"tnum" 1, "lnum" 1',
      whiteSpace: 'nowrap',
      textAlign: 'end',
      minWidthCh: 7,
      minimumScaleFactor: 0.82,
      overflowStrategy:
        'Wrap labels before amounts; never clip digits; allow horizontal table scroll only when needed.',
    },
    rendering: {
      useIntegerMinorUnits: true,
      useIso4217CurrencyCode: true,
      deriveFractionDigitsFromCurrency: true,
      neverUseBinaryFloat: true,
      showCurrencyCodeWhenAmbiguous: true,
      preserveLocaleGrouping: true,
      negativePattern: 'locale-minus',
      privacyModeReplacement: 'masked',
      screenReaderTemplate: 'currency code, signed amount, estimate status when applicable',
    },
  },
} as const;

export type FolioTokens = typeof folioTokens;
export type ColorRole = keyof FolioTokens['color']['role'];
export type TextRole = keyof FolioTokens['typography']['role'];
export type SpacingToken = keyof FolioTokens['spacing']['scale'];
export type InteractionState = keyof FolioTokens['interaction']['state'];
export type MotionPreference = keyof FolioTokens['motion']['preference'];
export type SemanticStatus = keyof FolioTokens['status'];
export type HitTargetPolicy = FolioTokens['hitTarget'];
export type MoneyTextRenderingRules = FolioTokens['money'];

export function meetsNativeHitTarget(sizeDp: Dp): boolean {
  return sizeDp >= folioTokens.hitTarget.minimumDp;
}

export function getInteractionStateTokens<State extends InteractionState>(
  state: State,
): FolioTokens['interaction']['state'][State] {
  return folioTokens.interaction.state[state];
}

export function getMotionPreferenceTokens<Preference extends MotionPreference>(
  preference: Preference,
): FolioTokens['motion']['preference'][Preference] {
  return folioTokens.motion.preference[preference];
}

export function getSemanticStatusTokens<Status extends SemanticStatus>(
  status: Status,
): FolioTokens['status'][Status] {
  return folioTokens.status[status];
}
