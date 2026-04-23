import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import withSplashScreen from './index';

type Platform = 'android' | 'ios';

function makeRequest(
  projectRoot: string,
  platformProjectRoot: string,
  modName: string,
  platform: Platform,
) {
  return { projectRoot, platformProjectRoot, modName, platform, introspect: false };
}

function baseConfig() {
  return { name: 'test-app', slug: 'test-app' } as never;
}

function getMod(
  modded: unknown,
  platform: Platform,
  name: string,
): (cfg: unknown) => Promise<{ modResults: Record<string, unknown> }> {
  const c = modded as { mods: Record<Platform, Record<string, unknown>> };
  const m = c.mods[platform][name];
  if (typeof m !== 'function') {
    throw new Error(`mod mods.${platform}.${name} not registered`);
  }
  return m as never;
}

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

let projectRoot: string;

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'esfs-mods-'));
  fs.mkdirSync(path.join(projectRoot, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'assets', 'splash.png'), PNG_1X1);
  fs.writeFileSync(path.join(projectRoot, 'assets', 'icon.png'), PNG_1X1);
});

afterEach(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

describe('android dangerous mods', () => {
  test('write drawables for all densities + splashscreen.xml', async () => {
    const platformProjectRoot = path.join(projectRoot, 'android');
    fs.mkdirSync(platformProjectRoot, { recursive: true });

    const modded = withSplashScreen(baseConfig(), {
      image: './assets/splash.png',
      iconSplash: { image: './assets/icon.png' },
      fadeIn: 400,
      backgroundColor: '#123456',
    });
    const dangerous = getMod(modded, 'android', 'dangerous');

    await dangerous({
      ...modded,
      modRequest: makeRequest(projectRoot, platformProjectRoot, 'dangerous', 'android'),
      modResults: undefined,
    });

    const resDir = path.join(platformProjectRoot, 'app/src/main/res');
    for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
      expect(fs.existsSync(path.join(resDir, `drawable-${density}/splash_fullscreen.png`))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(resDir, `drawable-${density}/splash_icon.png`))).toBe(true);
    }

    const xml = fs.readFileSync(path.join(resDir, 'values/splashscreen.xml'), 'utf-8');
    expect(xml).toContain('<bool name="splash_icon_enabled">true</bool>');
    expect(xml).toContain('<integer name="splash_fade_in">400</integer>');
    expect(xml).toContain('<integer name="splash_fullscreen_hold_ms">600</integer>');
    expect(xml).toContain('<color name="splash_background">#123456</color>');

    // Icon enabled → emits splash_icon_window layer-list so the cold-start window paints
    // bg + centered icon from frame 1. splash_fullscreen_window belongs to the icon-disabled path.
    expect(fs.existsSync(path.join(resDir, 'drawable/splash_fullscreen_window.xml'))).toBe(false);
    const iconLayerPath = path.join(resDir, 'drawable/splash_icon_window.xml');
    expect(fs.existsSync(iconLayerPath)).toBe(true);
    const iconLayer = fs.readFileSync(iconLayerPath, 'utf-8');
    expect(iconLayer).toContain('@color/splash_background');
    expect(iconLayer).toContain('@drawable/splash_icon');
    expect(iconLayer).toContain('android:gravity="center"');
    expect(iconLayer).toContain('android:width="200dp"');
    expect(iconLayer).toContain('android:height="200dp"');
  });

  test('skip icon drawables when iconSplash is absent', async () => {
    const platformProjectRoot = path.join(projectRoot, 'android');
    fs.mkdirSync(platformProjectRoot, { recursive: true });

    const modded = withSplashScreen(baseConfig(), { image: './assets/splash.png' });
    const dangerous = getMod(modded, 'android', 'dangerous');

    await dangerous({
      ...modded,
      modRequest: makeRequest(projectRoot, platformProjectRoot, 'dangerous', 'android'),
      modResults: undefined,
    });

    const resDir = path.join(platformProjectRoot, 'app/src/main/res');
    expect(fs.existsSync(path.join(resDir, 'drawable-mdpi/splash_fullscreen.png'))).toBe(true);
    expect(fs.existsSync(path.join(resDir, 'drawable-mdpi/splash_icon.png'))).toBe(false);

    const xml = fs.readFileSync(path.join(resDir, 'values/splashscreen.xml'), 'utf-8');
    expect(xml).toContain('<bool name="splash_icon_enabled">false</bool>');

    // Icon disabled → layer-list drawable is emitted so the cold-start window renders
    // the full-screen splash instead of a flat background color.
    const layerListPath = path.join(resDir, 'drawable/splash_fullscreen_window.xml');
    expect(fs.existsSync(layerListPath)).toBe(true);
    const layerList = fs.readFileSync(layerListPath, 'utf-8');
    expect(layerList).toContain('@color/splash_background');
    expect(layerList).toContain('@drawable/splash_fullscreen');
    expect(layerList).toContain('android:gravity="fill"');
  });

  test('skip icon drawables when iconSplash.android is false', async () => {
    const platformProjectRoot = path.join(projectRoot, 'android');
    fs.mkdirSync(platformProjectRoot, { recursive: true });

    const modded = withSplashScreen(baseConfig(), {
      image: './assets/splash.png',
      iconSplash: { image: './assets/icon.png', android: false, ios: true },
    });
    const dangerous = getMod(modded, 'android', 'dangerous');

    await dangerous({
      ...modded,
      modRequest: makeRequest(projectRoot, platformProjectRoot, 'dangerous', 'android'),
      modResults: undefined,
    });

    const resDir = path.join(platformProjectRoot, 'app/src/main/res');
    expect(fs.existsSync(path.join(resDir, 'drawable-mdpi/splash_icon.png'))).toBe(false);
    expect(fs.existsSync(path.join(resDir, 'drawable-mdpi/splash_fullscreen.png'))).toBe(true);
  });

  test('throw when source image missing', async () => {
    const platformProjectRoot = path.join(projectRoot, 'android');
    fs.mkdirSync(platformProjectRoot, { recursive: true });

    const modded = withSplashScreen(baseConfig(), { image: './missing.png' });
    const dangerous = getMod(modded, 'android', 'dangerous');

    await expect(
      dangerous({
        ...modded,
        modRequest: makeRequest(projectRoot, platformProjectRoot, 'dangerous', 'android'),
        modResults: undefined,
      }),
    ).rejects.toThrow(/Full-screen image not found/);
  });

  test('throw when iconSplash image missing', async () => {
    const platformProjectRoot = path.join(projectRoot, 'android');
    fs.mkdirSync(platformProjectRoot, { recursive: true });

    const modded = withSplashScreen(baseConfig(), {
      image: './assets/splash.png',
      iconSplash: { image: './missing-icon.png' },
    });
    const dangerous = getMod(modded, 'android', 'dangerous');

    await expect(
      dangerous({
        ...modded,
        modRequest: makeRequest(projectRoot, platformProjectRoot, 'dangerous', 'android'),
        modResults: undefined,
      }),
    ).rejects.toThrow(/iconSplash image not found/);
  });
});

type StylesResult = {
  resources: {
    style: Array<{ $: { name: string }; item: Array<{ $: { name: string }; _: string }> }>;
  };
};

function makeStylesInput() {
  return {
    resources: {
      style: [
        {
          $: { name: 'AppTheme' },
          item: [{ $: { name: 'android:windowBackground' }, _: '@drawable/old' }],
        },
        { $: { name: 'Theme.App.SplashScreen' }, item: [] as Array<never> },
        { $: { name: 'Unrelated' }, item: [{ $: { name: 'x' }, _: 'y' }] },
      ],
    },
  };
}

describe('android styles mod', () => {
  test('windowBackground → fullscreen drawable when iconSplash.android is disabled', async () => {
    const modded = withSplashScreen(baseConfig(), { image: './assets/splash.png' });
    const styles = getMod(modded, 'android', 'styles');

    const result = await styles({
      ...modded,
      modRequest: makeRequest(projectRoot, path.join(projectRoot, 'android'), 'styles', 'android'),
      modResults: makeStylesInput(),
    });

    const out = (result.modResults as never as StylesResult).resources.style;

    const appTheme = out.find((s) => s.$.name === 'AppTheme')!;
    expect(appTheme.item.find((i) => i.$.name === 'android:windowBackground')!._).toBe(
      '@drawable/splash_fullscreen_window',
    );

    const splashTheme = out.find((s) => s.$.name === 'Theme.App.SplashScreen')!;
    expect(splashTheme.item.find((i) => i.$.name === 'android:windowBackground')!._).toBe(
      '@drawable/splash_fullscreen_window',
    );

    const unrelated = out.find((s) => s.$.name === 'Unrelated')!;
    expect(unrelated.item).toEqual([{ $: { name: 'x' }, _: 'y' }]);
  });

  test('windowBackground → icon-window drawable when iconSplash.android is enabled', async () => {
    const modded = withSplashScreen(baseConfig(), {
      image: './assets/splash.png',
      iconSplash: { image: './assets/icon.png', android: true, ios: false },
    });
    const styles = getMod(modded, 'android', 'styles');

    const result = await styles({
      ...modded,
      modRequest: makeRequest(projectRoot, path.join(projectRoot, 'android'), 'styles', 'android'),
      modResults: makeStylesInput(),
    });

    const out = (result.modResults as never as StylesResult).resources.style;

    const appTheme = out.find((s) => s.$.name === 'AppTheme')!;
    expect(appTheme.item.find((i) => i.$.name === 'android:windowBackground')!._).toBe(
      '@drawable/splash_icon_window',
    );

    const splashTheme = out.find((s) => s.$.name === 'Theme.App.SplashScreen')!;
    expect(splashTheme.item.find((i) => i.$.name === 'android:windowBackground')!._).toBe(
      '@drawable/splash_icon_window',
    );
  });

  test('early-returns when resources.style is not an array', async () => {
    const modded = withSplashScreen(baseConfig(), { image: './assets/splash.png' });
    const styles = getMod(modded, 'android', 'styles');

    const result = await styles({
      ...modded,
      modRequest: makeRequest(projectRoot, path.join(projectRoot, 'android'), 'styles', 'android'),
      modResults: { resources: {} },
    });

    expect(result.modResults).toEqual({ resources: {} });
  });
});

describe('ios dangerous mods', () => {
  function setupIos(): string {
    const platformProjectRoot = path.join(projectRoot, 'ios');
    const appDir = path.join(platformProjectRoot, 'TestApp');
    fs.mkdirSync(path.join(appDir, 'Images.xcassets'), { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'SplashScreen.storyboard'),
      '<?xml version="1.0"?><placeholder/>',
    );
    return platformProjectRoot;
  }

  test('write imagesets (1x/2x/3x + Contents.json) + rewrite storyboard', async () => {
    const platformProjectRoot = setupIos();

    const modded = withSplashScreen(baseConfig(), {
      image: './assets/splash.png',
      iconSplash: { image: './assets/icon.png' },
      backgroundColor: '#0A0A0A',
    });
    const dangerous = getMod(modded, 'ios', 'dangerous');

    await dangerous({
      ...modded,
      modRequest: makeRequest(projectRoot, platformProjectRoot, 'dangerous', 'ios'),
      modResults: undefined,
    });

    const appDir = path.join(platformProjectRoot, 'TestApp');
    for (const suffix of ['', '@2x', '@3x']) {
      expect(
        fs.existsSync(
          path.join(
            appDir,
            'Images.xcassets/SplashFullScreen.imageset',
            `splashfullscreen${suffix}.png`,
          ),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(appDir, 'Images.xcassets/SplashIcon.imageset', `splashicon${suffix}.png`),
        ),
      ).toBe(true);
    }

    const contents = JSON.parse(
      fs.readFileSync(
        path.join(appDir, 'Images.xcassets/SplashFullScreen.imageset/Contents.json'),
        'utf-8',
      ),
    ) as { images: Array<{ scale: string }>; info: { author: string } };
    expect(contents.images).toHaveLength(3);
    expect(contents.info.author).toBe('miiny1206');
    expect(contents.images[1]!.scale).toBe('2x');

    const storyboard = fs.readFileSync(path.join(appDir, 'SplashScreen.storyboard'), 'utf-8');
    expect(storyboard).toContain('launchScreen="YES"');
    expect(storyboard).toContain('image="SplashIcon"');
    expect(storyboard).toContain('red="0.039216"');
    // Icon size locked to the configured iconWidth (default 200) so the storyboard → overlay
    // hand-off doesn't jump in size.
    expect(storyboard).toContain('firstAttribute="width" constant="200"');
    expect(storyboard).toContain('firstAttribute="height" constant="200"');
    expect(storyboard).toContain('<image name="SplashIcon" width="200" height="200"/>');
  });

  test('storyboard icon size follows iconSplash.imageWidth', async () => {
    const platformProjectRoot = setupIos();

    const modded = withSplashScreen(baseConfig(), {
      image: './assets/splash.png',
      iconSplash: { image: './assets/icon.png', imageWidth: 260 },
    });
    const dangerous = getMod(modded, 'ios', 'dangerous');

    await dangerous({
      ...modded,
      modRequest: makeRequest(projectRoot, platformProjectRoot, 'dangerous', 'ios'),
      modResults: undefined,
    });

    const storyboard = fs.readFileSync(
      path.join(platformProjectRoot, 'TestApp/SplashScreen.storyboard'),
      'utf-8',
    );
    expect(storyboard).toContain('firstAttribute="width" constant="260"');
    expect(storyboard).toContain('firstAttribute="height" constant="260"');
    expect(storyboard).toContain('<image name="SplashIcon" width="260" height="260"/>');
  });

  test('storyboard embeds fullscreen when iconSplash.ios is false', async () => {
    const platformProjectRoot = setupIos();

    const modded = withSplashScreen(baseConfig(), {
      image: './assets/splash.png',
      iconSplash: { image: './assets/icon.png', ios: false, android: true },
    });
    const dangerous = getMod(modded, 'ios', 'dangerous');

    await dangerous({
      ...modded,
      modRequest: makeRequest(projectRoot, platformProjectRoot, 'dangerous', 'ios'),
      modResults: undefined,
    });

    const appDir = path.join(platformProjectRoot, 'TestApp');
    expect(fs.existsSync(path.join(appDir, 'Images.xcassets/SplashIcon.imageset'))).toBe(false);

    const storyboard = fs.readFileSync(path.join(appDir, 'SplashScreen.storyboard'), 'utf-8');
    expect(storyboard).not.toContain('image="SplashIcon"');
    // Icon disabled → launch paints full splash from frame 1 so the storyboard → overlay
    // handoff shows no bg-only gap.
    expect(storyboard).toContain('image="SplashFullScreen"');
    expect(storyboard).toContain('contentMode="scaleAspectFill"');
    expect(storyboard).toContain('<image name="SplashFullScreen"');
    // Placeholder keeps <resources> parseable by @expo/prebuild-config's splash base mod.
    expect(storyboard).toContain('<image name="SplashScreenLogo"');
  });

  test('storyboard always emits SplashScreenLogo placeholder for expo base mod compat', async () => {
    const platformProjectRoot = setupIos();

    const modded = withSplashScreen(baseConfig(), { image: './assets/splash.png' });
    const dangerous = getMod(modded, 'ios', 'dangerous');

    await dangerous({
      ...modded,
      modRequest: makeRequest(projectRoot, platformProjectRoot, 'dangerous', 'ios'),
      modResults: undefined,
    });

    const storyboard = fs.readFileSync(
      path.join(platformProjectRoot, 'TestApp/SplashScreen.storyboard'),
      'utf-8',
    );
    expect(storyboard).toContain('<image name="SplashScreenLogo"');
  });

  test('throw when source image missing', async () => {
    const platformProjectRoot = setupIos();

    const modded = withSplashScreen(baseConfig(), { image: './missing.png' });
    const dangerous = getMod(modded, 'ios', 'dangerous');

    await expect(
      dangerous({
        ...modded,
        modRequest: makeRequest(projectRoot, platformProjectRoot, 'dangerous', 'ios'),
        modResults: undefined,
      }),
    ).rejects.toThrow(/Full-screen image not found/);
  });

  test('throw when iconSplash image missing', async () => {
    const platformProjectRoot = setupIos();

    const modded = withSplashScreen(baseConfig(), {
      image: './assets/splash.png',
      iconSplash: { image: './missing-icon.png' },
    });
    const dangerous = getMod(modded, 'ios', 'dangerous');

    await expect(
      dangerous({
        ...modded,
        modRequest: makeRequest(projectRoot, platformProjectRoot, 'dangerous', 'ios'),
        modResults: undefined,
      }),
    ).rejects.toThrow(/iconSplash image not found/);
  });
});

describe('ios infoPlist mod', () => {
  test('sets every Splash* key from props', async () => {
    const modded = withSplashScreen(baseConfig(), {
      image: './assets/splash.png',
      backgroundColor: '#0A0A0A',
      fadeIn: 300,
      fadeOut: 400,
      iconDisplayMs: 1500,
      crossfadeMs: 500,
      fullscreenHoldMs: 700,
      iconSplash: { image: './assets/icon.png', imageWidth: 220 },
    });
    const plistMod = getMod(modded, 'ios', 'infoPlist');

    const result = await plistMod({
      ...modded,
      modRequest: makeRequest(projectRoot, path.join(projectRoot, 'ios'), 'infoPlist', 'ios'),
      modResults: {},
    });

    expect(result.modResults).toMatchObject({
      SplashBackgroundColor: '#0A0A0A',
      SplashFadeIn: 300,
      SplashFadeOut: 400,
      SplashIconDisplayMs: 1500,
      SplashCrossfadeMs: 500,
      SplashFullscreenHoldMs: 700,
      SplashIconEnabled: true,
      SplashIconWidth: 220,
    });
  });

  test('SplashIconEnabled is false when iconSplash.ios is false', async () => {
    const modded = withSplashScreen(baseConfig(), {
      image: './assets/splash.png',
      iconSplash: { image: './assets/icon.png', ios: false, android: true },
    });
    const plistMod = getMod(modded, 'ios', 'infoPlist');

    const result = await plistMod({
      ...modded,
      modRequest: makeRequest(projectRoot, path.join(projectRoot, 'ios'), 'infoPlist', 'ios'),
      modResults: {},
    });

    expect(result.modResults.SplashIconEnabled).toBe(false);
  });

  test('defaults apply when iconSplash omitted entirely', async () => {
    const modded = withSplashScreen(baseConfig(), { image: './assets/splash.png' });
    const plistMod = getMod(modded, 'ios', 'infoPlist');

    const result = await plistMod({
      ...modded,
      modRequest: makeRequest(projectRoot, path.join(projectRoot, 'ios'), 'infoPlist', 'ios'),
      modResults: {},
    });

    expect(result.modResults.SplashIconEnabled).toBe(false);
    expect(result.modResults.SplashIconWidth).toBe(200);
    expect(result.modResults.SplashFadeIn).toBe(250);
  });
});
