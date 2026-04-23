import { type ConfigPlugin, withDangerousMod, withInfoPlist } from '@expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';

import type { NormalizedProps } from './types';
import { PACKAGE_NAME, canResizeWithSips, hexToRgb01, writeScaled } from './utils';

const IOS_SCALES = [
  { suffix: '', scale: 1 },
  { suffix: '@2x', scale: 2 },
  { suffix: '@3x', scale: 3 },
] as const;

export const withIos: ConfigPlugin<NormalizedProps> = (config, props) => {
  config = withIosAssets(config, props);
  config = withIosInfoPlistKeys(config, props);
  config = withIosStoryboard(config, props);
  return config;
};

const withIosAssets: ConfigPlugin<NormalizedProps> = (config, props) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const appRoot = cfg.modRequest.projectRoot;
      const useSips = canResizeWithSips();

      const appDirs = fs
        .readdirSync(projectRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(projectRoot, e.name))
        .filter((d) => fs.existsSync(path.join(d, 'Images.xcassets')));

      const fullscreenSource = path.resolve(appRoot, props.image);
      if (!fs.existsSync(fullscreenSource)) {
        throw new Error(`[${PACKAGE_NAME}] Full-screen image not found: ${fullscreenSource}`);
      }

      for (const appDir of appDirs) {
        writeImageset(
          path.join(appDir, 'Images.xcassets', 'SplashFullScreen.imageset'),
          fullscreenSource,
          props.baseWidth,
          props.baseHeight,
          useSips,
        );

        if (props.iconSplash?.ios) {
          const iconSource = path.resolve(appRoot, props.iconSplash.image);
          if (!fs.existsSync(iconSource)) {
            throw new Error(`[${PACKAGE_NAME}] iconSplash image not found: ${iconSource}`);
          }
          writeImageset(
            path.join(appDir, 'Images.xcassets', 'SplashIcon.imageset'),
            iconSource,
            props.iconSplash.imageWidth,
            props.iconSplash.imageWidth,
            useSips,
          );
        }
      }

      return cfg;
    },
  ]);

const withIosInfoPlistKeys: ConfigPlugin<NormalizedProps> = (config, props) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults.SplashIconEnabled = !!props.iconSplash?.ios;
    cfg.modResults.SplashIconWidth = props.iconSplash?.imageWidth ?? 200;
    cfg.modResults.SplashFadeIn = props.fadeIn;
    cfg.modResults.SplashFadeOut = props.fadeOut;
    cfg.modResults.SplashIconDisplayMs = props.iconDisplayMs;
    cfg.modResults.SplashCrossfadeMs = props.crossfadeMs;
    cfg.modResults.SplashFullscreenHoldMs = props.fullscreenHoldMs;
    cfg.modResults.SplashBackgroundColor = props.backgroundColor;
    return cfg;
  });

const withIosStoryboard: ConfigPlugin<NormalizedProps> = (config, props) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const appDirs = fs
        .readdirSync(projectRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(projectRoot, e.name))
        .filter((d) => fs.existsSync(path.join(d, 'SplashScreen.storyboard')));

      const { r, g, b } = hexToRgb01(props.backgroundColor);
      const storyboard = buildStoryboard(r, g, b, !!props.iconSplash?.ios);

      for (const appDir of appDirs) {
        fs.writeFileSync(path.join(appDir, 'SplashScreen.storyboard'), storyboard);
      }

      return cfg;
    },
  ]);

function writeImageset(
  imagesetDir: string,
  source: string,
  widthPt: number,
  heightPt: number,
  useSips: boolean,
): void {
  fs.mkdirSync(imagesetDir, { recursive: true });
  const base = path.basename(imagesetDir, '.imageset').toLowerCase();

  for (const { suffix, scale } of IOS_SCALES) {
    writeScaled(
      source,
      path.join(imagesetDir, `${base}${suffix}.png`),
      Math.round(widthPt * scale),
      Math.round(heightPt * scale),
      useSips,
    );
  }

  const images = IOS_SCALES.map(({ suffix, scale }) => ({
    idiom: 'universal',
    filename: `${base}${suffix}.png`,
    scale: `${scale}x`,
  }));

  fs.writeFileSync(
    path.join(imagesetDir, 'Contents.json'),
    `${JSON.stringify({ images, info: { version: 1, author: 'miiny1206' } }, null, 2)}\n`,
  );
}

function buildStoryboard(r: string, g: string, b: string, iconEnabled: boolean): string {
  const iconImage = iconEnabled
    ? `<imageView opaque="NO" clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFit" image="SplashIcon" translatesAutoresizingMaskIntoConstraints="NO" id="JMI-01-000"/>`
    : '';
  const iconConstraints = iconEnabled
    ? `<constraint firstItem="JMI-01-000" firstAttribute="centerX" secondItem="Ze5-6b-2t3" secondAttribute="centerX" id="JMI-01-cx"/>
                            <constraint firstItem="JMI-01-000" firstAttribute="centerY" secondItem="Ze5-6b-2t3" secondAttribute="centerY" id="JMI-01-cy"/>
                            <constraint firstItem="JMI-01-000" firstAttribute="width" secondItem="Ze5-6b-2t3" secondAttribute="width" multiplier="0.33" id="JMI-01-w"/>
                            <constraint firstItem="JMI-01-000" firstAttribute="height" secondItem="JMI-01-000" secondAttribute="width" id="JMI-01-h"/>`
    : '';
  const iconImageRef = iconEnabled ? `<image name="SplashIcon" width="400" height="400"/>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="17701" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="EXPO-VIEWCONTROLLER-1">
    <device id="retina6_12" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="17703"/>
        <capability name="Named colors" minToolsVersion="9.0"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="EXPO-SCENE-1">
            <objects>
                <viewController storyboardIdentifier="SplashScreenViewController" id="EXPO-VIEWCONTROLLER-1" sceneMemberID="viewController">
                    <view key="view" userInteractionEnabled="NO" contentMode="scaleToFill" insetsLayoutMarginsFromSafeArea="NO" id="Ze5-6b-2t3">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" flexibleMaxX="YES" flexibleMaxY="YES"/>
                        <subviews>
                            ${iconImage}
                        </subviews>
                        <color key="backgroundColor" red="${r}" green="${g}" blue="${b}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                        <constraints>
                            ${iconConstraints}
                        </constraints>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="EXPO-PLACEHOLDER-1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="-33" y="-70"/>
        </scene>
    </scenes>
    <resources>
        ${iconImageRef}
    </resources>
</document>
`;
}
