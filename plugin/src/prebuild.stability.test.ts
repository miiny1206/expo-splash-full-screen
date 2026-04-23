import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import xml2js from 'xml2js';

import withSplashScreen from './index';
import type { IconSplashProps } from './types';

type Platform = 'android' | 'ios';

type StyleItem = { $: { name: string }; _?: string };
type Style = { $: { name: string }; item?: StyleItem[] };
type StylesDoc = { resources: { style: Style[] } };
type ModFn = (cfg: unknown) => Promise<{ modResults: unknown }>;

// Shapes xml2js returns for the storyboard's <resources> element. Guard against the historical
// "string" shape that crashes @expo/prebuild-config's base mod with
// "Cannot create property 'image' on string".
type ResourcesNode = Record<string, unknown>;
type ParsedStoryboard = { document: { resources: Array<ResourcesNode | string> } };

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

// Full matrix of iconSplash shapes a consumer app could realistically pass. Every combination
// must survive prebuild without throwing AND produce artifacts that won't crash the native
// module at launch.
const ICON_COMBOS: Array<{ label: string; iconSplash: IconSplashProps | undefined }> = [
  { label: 'iconSplash undefined', iconSplash: undefined },
  { label: 'iconSplash minimal (defaults applied)', iconSplash: { image: './assets/icon.png' } },
  {
    label: 'iconSplash both true',
    iconSplash: { image: './assets/icon.png', android: true, ios: true },
  },
  {
    label: 'iconSplash both false',
    iconSplash: { image: './assets/icon.png', android: false, ios: false },
  },
  {
    label: 'iconSplash android only',
    iconSplash: { image: './assets/icon.png', android: true, ios: false },
  },
  {
    label: 'iconSplash ios only',
    iconSplash: { image: './assets/icon.png', android: false, ios: true },
  },
];

function baseConfig() {
  return { name: 'test-app', slug: 'test-app' } as never;
}

function makeRequest(
  projectRootArg: string,
  platformProjectRoot: string,
  modName: string,
  platform: Platform,
) {
  return {
    projectRoot: projectRootArg,
    platformProjectRoot,
    modName,
    platform,
    introspect: false,
  };
}

function getMod(modded: unknown, platform: Platform, name: string): ModFn {
  const c = modded as { mods: Record<Platform, Record<string, unknown>> };
  const m = c.mods[platform][name];
  if (typeof m !== 'function') throw new Error(`mod ${platform}.${name} missing`);
  return m as ModFn;
}

function makeStylesInput(): StylesDoc {
  return {
    resources: {
      style: [
        {
          $: { name: 'AppTheme' },
          item: [{ $: { name: 'android:windowBackground' }, _: '@drawable/old' }],
        },
        { $: { name: 'Theme.App.SplashScreen' }, item: [] },
      ],
    },
  };
}

let projectRoot: string;

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'esfs-stability-'));
  fs.mkdirSync(path.join(projectRoot, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'assets', 'splash.png'), PNG_1X1);
  fs.writeFileSync(path.join(projectRoot, 'assets', 'icon.png'), PNG_1X1);
});

afterEach(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

async function runAllMods(
  iconSplash: IconSplashProps | undefined,
  bg = '#0A0A0A',
): Promise<{
  androidResDir: string;
  iosAppDir: string;
  stylesOut: { modResults: unknown };
  plistOut: { modResults: unknown };
}> {
  const platformAndroid = path.join(projectRoot, 'android');
  const platformIos = path.join(projectRoot, 'ios');
  const appDir = path.join(platformIos, 'TestApp');
  fs.mkdirSync(platformAndroid, { recursive: true });
  fs.mkdirSync(path.join(appDir, 'Images.xcassets'), { recursive: true });
  fs.writeFileSync(
    path.join(appDir, 'SplashScreen.storyboard'),
    '<?xml version="1.0"?><placeholder/>',
  );

  const modded = withSplashScreen(baseConfig(), {
    image: './assets/splash.png',
    backgroundColor: bg,
    iconSplash,
  });

  await getMod(
    modded,
    'android',
    'dangerous',
  )({
    ...modded,
    modRequest: makeRequest(projectRoot, platformAndroid, 'dangerous', 'android'),
    modResults: undefined,
  });
  const stylesOut = await getMod(
    modded,
    'android',
    'styles',
  )({
    ...modded,
    modRequest: makeRequest(projectRoot, platformAndroid, 'styles', 'android'),
    modResults: makeStylesInput(),
  });
  await getMod(
    modded,
    'ios',
    'dangerous',
  )({
    ...modded,
    modRequest: makeRequest(projectRoot, platformIos, 'dangerous', 'ios'),
    modResults: undefined,
  });
  const plistOut = await getMod(
    modded,
    'ios',
    'infoPlist',
  )({
    ...modded,
    modRequest: makeRequest(projectRoot, platformIos, 'infoPlist', 'ios'),
    modResults: {},
  });

  return {
    androidResDir: path.join(platformAndroid, 'app/src/main/res'),
    iosAppDir: appDir,
    stylesOut,
    plistOut,
  };
}

describe('prebuild stability: every iconSplash combo runs without throwing', () => {
  for (const { label, iconSplash } of ICON_COMBOS) {
    test(label, async () => {
      await expect(runAllMods(iconSplash)).resolves.toBeDefined();
    });
  }
});

describe('iOS storyboard survives @expo/prebuild-config base mod', () => {
  // Regression guard: whitespace-only <resources> caused xml2js to parse resources[0] as string.
  // Base mod then ran `resources[0].image = resources[0].image ?? []` and crashed with
  // "Cannot create property 'image' on string". Every combo must keep resources[0] an object.
  for (const { label, iconSplash } of ICON_COMBOS) {
    test(`${label} → resources[0] is an object (base mod won't crash)`, async () => {
      const { iosAppDir } = await runAllMods(iconSplash);
      const storyboard = fs.readFileSync(path.join(iosAppDir, 'SplashScreen.storyboard'), 'utf-8');
      const parsed = (await xml2js.parseStringPromise(storyboard)) as ParsedStoryboard;
      const first = parsed.document.resources[0];
      expect(typeof first).toBe('object');
      expect(first).not.toBeNull();
      const target = first as ResourcesNode;
      expect(() => {
        target.image = target.image ?? [];
      }).not.toThrow();
    });

    test(`${label} → SplashScreenLogo placeholder always emitted`, async () => {
      const { iosAppDir } = await runAllMods(iconSplash);
      const storyboard = fs.readFileSync(path.join(iosAppDir, 'SplashScreen.storyboard'), 'utf-8');
      expect(storyboard).toContain('<image name="SplashScreenLogo"');
    });
  }
});

describe('iOS storyboard image refs resolve to on-disk imagesets', () => {
  // Storyboard references are UIKit asset lookups. A missing imageset makes iOS render a blank
  // UIImageView at launch (the launch-frame equivalent of a crash — no content shown).
  for (const { label, iconSplash } of ICON_COMBOS) {
    test(label, async () => {
      const { iosAppDir } = await runAllMods(iconSplash);
      const storyboard = fs.readFileSync(path.join(iosAppDir, 'SplashScreen.storyboard'), 'utf-8');
      if (storyboard.includes('image="SplashIcon"')) {
        expect(fs.existsSync(path.join(iosAppDir, 'Images.xcassets/SplashIcon.imageset'))).toBe(
          true,
        );
      }
      if (storyboard.includes('image="SplashFullScreen"')) {
        expect(
          fs.existsSync(path.join(iosAppDir, 'Images.xcassets/SplashFullScreen.imageset')),
        ).toBe(true);
      }
    });
  }
});

describe('Android styles windowBackground resolves to an emitted drawable', () => {
  // A dangling `@drawable/foo` ref would crash the Activity at inflation with
  // Resources$NotFoundException. Must always point at a real .xml/.png.
  for (const { label, iconSplash } of ICON_COMBOS) {
    test(label, async () => {
      const { androidResDir, stylesOut } = await runAllMods(iconSplash);
      const doc = stylesOut.modResults as StylesDoc;
      const appTheme = doc.resources.style.find((s) => s.$.name === 'AppTheme');
      const splashTheme = doc.resources.style.find((s) => s.$.name === 'Theme.App.SplashScreen');
      const appBg = appTheme?.item?.find((i) => i.$.name === 'android:windowBackground')?._;
      const splashBg = splashTheme?.item?.find((i) => i.$.name === 'android:windowBackground')?._;

      expect(appBg).toBeDefined();
      expect(appBg).toBe(splashBg);
      expect(appBg).toMatch(/^@drawable\//);
      const drawableName = appBg!.replace('@drawable/', '');
      expect(fs.existsSync(path.join(androidResDir, 'drawable', `${drawableName}.xml`))).toBe(true);
    });
  }
});

describe('Android drawables referenced by layer-lists exist on disk', () => {
  // The layer-list windowBackground references @drawable/splash_fullscreen or splash_icon. If
  // the density PNGs are not emitted alongside, inflation throws at cold start.
  for (const { label, iconSplash } of ICON_COMBOS) {
    test(label, async () => {
      const { androidResDir, stylesOut } = await runAllMods(iconSplash);
      const doc = stylesOut.modResults as StylesDoc;
      const appBg = doc.resources.style
        .find((s) => s.$.name === 'AppTheme')
        ?.item?.find((i) => i.$.name === 'android:windowBackground')?._;
      const drawableName = appBg!.replace('@drawable/', '');
      const layerList = fs.readFileSync(
        path.join(androidResDir, 'drawable', `${drawableName}.xml`),
        'utf-8',
      );
      const match = layerList.match(/@drawable\/(splash_\w+)/g) ?? [];
      for (const ref of match) {
        const name = ref.replace('@drawable/', '');
        expect(fs.existsSync(path.join(androidResDir, 'drawable-mdpi', `${name}.png`))).toBe(true);
        expect(fs.existsSync(path.join(androidResDir, 'drawable-xxxhdpi', `${name}.png`))).toBe(
          true,
        );
      }
    });
  }
});

describe('Android splashscreen.xml exposes every key SplashScreenOverlay.kt reads', () => {
  // Kotlin looks up these names via getIdentifier(..., "bool"|"integer"|"color", pkg). Missing
  // keys don't crash (getIdentifier returns 0 → default) but user props get silently ignored.
  // Treat as a crash-prevention contract: wrap-break means native/plugin pair drifted.
  const REQUIRED = [
    { type: 'bool', name: 'splash_icon_enabled' },
    { type: 'integer', name: 'splash_icon_width' },
    { type: 'integer', name: 'splash_fade_in' },
    { type: 'integer', name: 'splash_fade_out' },
    { type: 'integer', name: 'splash_icon_display_ms' },
    { type: 'integer', name: 'splash_crossfade_ms' },
    { type: 'integer', name: 'splash_fullscreen_hold_ms' },
    { type: 'color', name: 'splash_background' },
  ];

  for (const { label, iconSplash } of ICON_COMBOS) {
    test(label, async () => {
      const { androidResDir } = await runAllMods(iconSplash);
      const xml = fs.readFileSync(path.join(androidResDir, 'values/splashscreen.xml'), 'utf-8');
      for (const { type, name } of REQUIRED) {
        expect(xml).toContain(`<${type} name="${name}"`);
      }
    });
  }
});

describe('iOS Info.plist exposes every key SplashScreenOverlay.swift reads', () => {
  // currentConfig() reads these via info.infoDictionary[]. Missing keys fall back to defaults;
  // plugin contract says we emit all of them so user props survive prebuild.
  const REQUIRED = [
    'SplashIconEnabled',
    'SplashIconWidth',
    'SplashFadeIn',
    'SplashFadeOut',
    'SplashIconDisplayMs',
    'SplashCrossfadeMs',
    'SplashFullscreenHoldMs',
    'SplashBackgroundColor',
  ];

  for (const { label, iconSplash } of ICON_COMBOS) {
    test(label, async () => {
      const { plistOut } = await runAllMods(iconSplash);
      const plist = plistOut.modResults as Record<string, unknown>;
      for (const key of REQUIRED) {
        expect(plist[key]).toBeDefined();
      }
    });
  }
});

describe('Android styles mod is defensive against malformed inputs', () => {
  test('missing AppTheme / SplashScreen styles → no throw', async () => {
    const modded = withSplashScreen(baseConfig(), { image: './assets/splash.png' });
    const styles = getMod(modded, 'android', 'styles');
    await expect(
      styles({
        ...modded,
        modRequest: makeRequest(
          projectRoot,
          path.join(projectRoot, 'android'),
          'styles',
          'android',
        ),
        modResults: { resources: { style: [{ $: { name: 'SomethingElse' }, item: [] }] } },
      }),
    ).resolves.toBeDefined();
  });

  test('style.item missing → windowBackground item created, no throw', async () => {
    const modded = withSplashScreen(baseConfig(), { image: './assets/splash.png' });
    const styles = getMod(modded, 'android', 'styles');
    const result = await styles({
      ...modded,
      modRequest: makeRequest(projectRoot, path.join(projectRoot, 'android'), 'styles', 'android'),
      modResults: {
        resources: {
          style: [{ $: { name: 'AppTheme' } }, { $: { name: 'Theme.App.SplashScreen' } }],
        },
      },
    });
    const styleList = (result.modResults as StylesDoc).resources.style;
    expect(Array.isArray(styleList[0]!.item)).toBe(true);
    expect(styleList[0]!.item!.find((i) => i.$.name === 'android:windowBackground')).toBeDefined();
  });

  test('resources.style not an array → early return, no throw', async () => {
    const modded = withSplashScreen(baseConfig(), { image: './assets/splash.png' });
    const styles = getMod(modded, 'android', 'styles');
    await expect(
      styles({
        ...modded,
        modRequest: makeRequest(
          projectRoot,
          path.join(projectRoot, 'android'),
          'styles',
          'android',
        ),
        modResults: { resources: {} },
      }),
    ).resolves.toBeDefined();
  });

  test('existing windowBackground value is replaced, not duplicated', async () => {
    const modded = withSplashScreen(baseConfig(), { image: './assets/splash.png' });
    const styles = getMod(modded, 'android', 'styles');
    const result = await styles({
      ...modded,
      modRequest: makeRequest(projectRoot, path.join(projectRoot, 'android'), 'styles', 'android'),
      modResults: makeStylesInput(),
    });
    const appTheme = (result.modResults as StylesDoc).resources.style.find(
      (s) => s.$.name === 'AppTheme',
    )!;
    const bgItems = appTheme.item!.filter((i) => i.$.name === 'android:windowBackground');
    expect(bgItems).toHaveLength(1);
    expect(bgItems[0]!._).toMatch(/^@drawable\//);
  });
});

describe('storyboard tolerates varied hex color shapes', () => {
  // hexToRgb01 handles 3-char shorthand and optional # prefix. Storyboard must stay parseable
  // regardless — the base mod walks the entire XML tree.
  for (const bg of ['#000', '#000000', '000000', '#ABC', '#FF8000', '#FFFFFF']) {
    test(`bg=${bg} → storyboard parses`, async () => {
      const { iosAppDir } = await runAllMods(undefined, bg);
      const storyboard = fs.readFileSync(path.join(iosAppDir, 'SplashScreen.storyboard'), 'utf-8');
      await expect(xml2js.parseStringPromise(storyboard)).resolves.toBeDefined();
    });
  }
});

describe('minimal config emits a complete prebuild surface', () => {
  test('image-only props → all artifacts written, native-readable', async () => {
    const { androidResDir, iosAppDir, stylesOut, plistOut } = await runAllMods(undefined);

    // Android surface.
    expect(fs.existsSync(path.join(androidResDir, 'values/splashscreen.xml'))).toBe(true);
    expect(fs.existsSync(path.join(androidResDir, 'drawable-mdpi/splash_fullscreen.png'))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(androidResDir, 'drawable-xxxhdpi/splash_fullscreen.png'))).toBe(
      true,
    );
    const appBg = (stylesOut.modResults as StylesDoc).resources.style
      .find((s) => s.$.name === 'AppTheme')
      ?.item?.find((i) => i.$.name === 'android:windowBackground')?._;
    expect(appBg).toBe('@drawable/splash_fullscreen_window');
    expect(fs.existsSync(path.join(androidResDir, 'drawable/splash_fullscreen_window.xml'))).toBe(
      true,
    );

    // iOS surface.
    expect(fs.existsSync(path.join(iosAppDir, 'Images.xcassets/SplashFullScreen.imageset'))).toBe(
      true,
    );
    const storyboard = fs.readFileSync(path.join(iosAppDir, 'SplashScreen.storyboard'), 'utf-8');
    expect(storyboard).toContain('image="SplashFullScreen"');
    expect((plistOut.modResults as Record<string, unknown>).SplashBackgroundColor).toBe('#0A0A0A');
  });
});
