import { a as semverExports } from "../../../../index.js";
import { renderTemplate } from "./render-template.js";
const DEFAULT_VERSION_TEMPLATE = "$MAJOR.$MINOR.$PATCH";
const getVersionInfo = (params) => {
  const {
    lastRelease,
    config,
    input,
    versionKeyIncrement: _versionKeyIncrement
  } = params;
  let versionKeyIncrement = _versionKeyIncrement;
  const lastReleaseVersion = coerceVersion(lastRelease, {
    tagPrefix: config["tag-prefix"]
  });
  const inputVersion = coerceVersion(
    /**
     * Use the first override parameter to identify
     * a version, from the most accurate to the least
     */
    input.version || input.tag || input.name,
    {
      tagPrefix: config["tag-prefix"]
    }
  );
  const isPreVersionKeyIncrement = versionKeyIncrement?.startsWith("pre");
  if (!lastReleaseVersion && !inputVersion) {
    if (isPreVersionKeyIncrement) {
      defaultVersionInfo["$RESOLVED_VERSION"] = structuredClone(
        defaultVersionInfo["$NEXT_PRERELEASE_VERSION"]
      );
    }
    if (config["version-template"] && config["version-template"] !== DEFAULT_VERSION_TEMPLATE) {
      const defaultVersion = toSemver("0.1.0");
      const templateableVersion2 = getTemplatableVersion({
        version: defaultVersion,
        template: config["version-template"],
        inputVersion,
        versionKeyIncrement: versionKeyIncrement || "patch",
        preReleaseIdentifier: config["prerelease-identifier"]
      });
      for (const key of Object.keys(templateableVersion2)) {
        const keyTyped = key;
        if (templateableVersion2[keyTyped] && typeof templateableVersion2[keyTyped] === "object" && templateableVersion2[keyTyped].template) {
          templateableVersion2[keyTyped].version = renderTemplate({
            template: templateableVersion2[keyTyped].template,
            object: templateableVersion2[keyTyped]
          });
        }
      }
      let resolvedVersionObj = splitSemVersion({
        version: defaultVersion,
        template: config["version-template"],
        inputVersion,
        versionKeyIncrement: versionKeyIncrement || "patch",
        preReleaseIdentifier: config["prerelease-identifier"]
      });
      if (!resolvedVersionObj) {
        throw new Error("Failed to generate resolved version object");
      }
      resolvedVersionObj = {
        ...resolvedVersionObj,
        version: renderTemplate({
          template: config["version-template"],
          object: resolvedVersionObj
        })
      };
      templateableVersion2.$RESOLVED_VERSION = resolvedVersionObj;
      return templateableVersion2;
    }
    return defaultVersionInfo;
  }
  const shouldIncrementAsPrerelease = isPreVersionKeyIncrement && lastReleaseVersion?.prerelease?.length;
  if (shouldIncrementAsPrerelease) {
    versionKeyIncrement = "prerelease";
  }
  const templateableVersion = getTemplatableVersion({
    version: lastReleaseVersion,
    template: config["version-template"],
    inputVersion,
    versionKeyIncrement,
    preReleaseIdentifier: config["prerelease-identifier"]
  });
  if (config["version-template"] && config["version-template"] !== DEFAULT_VERSION_TEMPLATE) {
    for (const key of Object.keys(templateableVersion)) {
      const keyTyped = key;
      if (templateableVersion[keyTyped] && typeof templateableVersion[keyTyped] === "object" && templateableVersion[keyTyped].template) {
        templateableVersion[keyTyped].version = renderTemplate({
          template: templateableVersion[keyTyped].template,
          object: templateableVersion[keyTyped]
        });
      }
    }
  }
  return templateableVersion;
};
const toSemver = (version) => {
  const result = semverExports.parse(version);
  if (result) {
    return result;
  }
  return semverExports.coerce(version);
};
const coerceVersion = (input, opt) => {
  if (!input) {
    return null;
  }
  const stripTag = (input2) => !!opt?.tagPrefix && input2?.startsWith(opt.tagPrefix) ? input2.slice(opt.tagPrefix.length) : input2;
  return typeof input === "object" ? toSemver(stripTag(input.tag_name)) || toSemver(stripTag(input.name)) : toSemver(stripTag(input));
};
const defaultVersionInfo = {
  $NEXT_MAJOR_VERSION: {
    version: "1.0.0",
    template: "$MAJOR.$MINOR.$PATCH",
    inputVersion: null,
    versionKeyIncrement: "patch",
    inc: "major",
    $MAJOR: 1,
    $MINOR: 0,
    $PATCH: 0,
    $PRERELEASE: ""
  },
  $NEXT_MINOR_VERSION: {
    version: "0.1.0",
    template: "$MAJOR.$MINOR.$PATCH",
    inputVersion: null,
    versionKeyIncrement: "patch",
    inc: "minor",
    $MAJOR: 0,
    $MINOR: 1,
    $PATCH: 0,
    $PRERELEASE: ""
  },
  $NEXT_PATCH_VERSION: {
    version: "0.1.0",
    template: "$MAJOR.$MINOR.$PATCH",
    inputVersion: null,
    versionKeyIncrement: "patch",
    inc: "patch",
    $MAJOR: 0,
    $MINOR: 1,
    $PATCH: 0,
    $PRERELEASE: ""
  },
  $NEXT_PRERELEASE_VERSION: {
    version: "0.1.0-rc.0",
    template: "$MAJOR.$MINOR.$PATCH$PRERELEASE",
    inputVersion: null,
    versionKeyIncrement: "prerelease",
    inc: "prerelease",
    preReleaseIdentifier: "rc",
    $MAJOR: 0,
    $MINOR: 1,
    $PATCH: 0,
    $PRERELEASE: "-rc.0"
  },
  $INPUT_VERSION: null,
  $RESOLVED_VERSION: {
    version: "0.1.0",
    template: "$MAJOR.$MINOR.$PATCH",
    inputVersion: null,
    versionKeyIncrement: "patch",
    inc: "patch",
    $MAJOR: 0,
    $MINOR: 1,
    $PATCH: 0,
    $PRERELEASE: ""
  }
};
const splitSemVersion = (input, versionKey = "version") => {
  if (!input?.[versionKey]) {
    return;
  }
  const version = input.inc ? semverExports.inc(input[versionKey], input.inc, true, input.preReleaseIdentifier) : typeof input[versionKey] === "string" ? input[versionKey] : input[versionKey].version;
  const prereleaseVersion = !version ? "" : semverExports.prerelease(version)?.join(".") || "";
  return {
    ...input,
    version,
    $MAJOR: semverExports.major(version || ""),
    $MINOR: semverExports.minor(version || ""),
    $PATCH: semverExports.patch(version || ""),
    $PRERELEASE: prereleaseVersion ? `-${prereleaseVersion}` : "",
    $COMPLETE: version
  };
};
const getTemplatableVersion = (input) => {
  const templatableVersion = {
    $NEXT_MAJOR_VERSION: splitSemVersion({
      ...input,
      inc: "major"
    }),
    $NEXT_MAJOR_VERSION_MAJOR: splitSemVersion({
      ...input,
      inc: "major",
      template: "$MAJOR"
    }),
    $NEXT_MAJOR_VERSION_MINOR: splitSemVersion({
      ...input,
      inc: "major",
      template: "$MINOR"
    }),
    $NEXT_MAJOR_VERSION_PATCH: splitSemVersion({
      ...input,
      inc: "major",
      template: "$PATCH"
    }),
    $NEXT_MINOR_VERSION: splitSemVersion({ ...input, inc: "minor" }),
    $NEXT_MINOR_VERSION_MAJOR: splitSemVersion({
      ...input,
      inc: "minor",
      template: "$MAJOR"
    }),
    $NEXT_MINOR_VERSION_MINOR: splitSemVersion({
      ...input,
      inc: "minor",
      template: "$MINOR"
    }),
    $NEXT_MINOR_VERSION_PATCH: splitSemVersion({
      ...input,
      inc: "minor",
      template: "$PATCH"
    }),
    $NEXT_PATCH_VERSION: splitSemVersion({ ...input, inc: "patch" }),
    $NEXT_PATCH_VERSION_MAJOR: splitSemVersion({
      ...input,
      inc: "patch",
      template: "$MAJOR"
    }),
    $NEXT_PATCH_VERSION_MINOR: splitSemVersion({
      ...input,
      inc: "patch",
      template: "$MINOR"
    }),
    $NEXT_PATCH_VERSION_PATCH: splitSemVersion({
      ...input,
      inc: "patch",
      template: "$PATCH"
    }),
    $NEXT_PRERELEASE_VERSION: splitSemVersion({
      ...input,
      inc: "prerelease",
      template: "$PRERELEASE"
    }),
    $INPUT_VERSION: splitSemVersion(input, "inputVersion"),
    $RESOLVED_VERSION: splitSemVersion({
      ...input,
      inc: input.versionKeyIncrement || "patch"
    })
  };
  templatableVersion.$RESOLVED_VERSION = templatableVersion.$INPUT_VERSION || templatableVersion.$RESOLVED_VERSION;
  return templatableVersion;
};
export {
  defaultVersionInfo,
  getVersionInfo
};
