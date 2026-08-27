const prisma = require("../config/prisma");

const PACKAGE_FEATURE_MAP = {
  Starter: {
    basicReporting: true,
    advancedReports: false,
    scheduledExports: false,
    advancedAnalytics: false,
    maintenanceAlerts: false,
    gpsTelematics: false,
  },
  Professional: {
    basicReporting: true,
    advancedReports: true,
    scheduledExports: true,
    advancedAnalytics: true,
    maintenanceAlerts: false,
    gpsTelematics: false,
  },
  Enterprise: {
    basicReporting: true,
    advancedReports: true,
    scheduledExports: true,
    advancedAnalytics: true,
    maintenanceAlerts: true,
    gpsTelematics: true,
  },
};

const FEATURE_UPGRADE_PROMPTS = {
  advancedReports: {
    requiredTier: "Professional",
    description: "Advanced reporting and export features",
  },
  scheduledExports: {
    requiredTier: "Professional",
    description: "Automated report scheduling and delivery",
  },
  advancedAnalytics: {
    requiredTier: "Professional",
    description: "Enhanced vehicle and rental analytics",
  },
  maintenanceAlerts: {
    requiredTier: "Enterprise",
    description: "Automated compliance and maintenance alerts",
  },
  gpsTelematics: {
    requiredTier: "Enterprise",
    description: "GPS telematics add-on feature",
  },
};

function baseFeaturesForPackage(packageName) {
  return PACKAGE_FEATURE_MAP[packageName] || PACKAGE_FEATURE_MAP.Starter;
}

function resolveFeatures(packageName, featureOverrides = {}) {
  return { ...baseFeaturesForPackage(packageName), ...featureOverrides };
}

function buildUpgradePrompt(feature, currentPackage) {
  const item = FEATURE_UPGRADE_PROMPTS[feature] || { requiredTier: "Professional", description: "Premium feature" };
  return {
    currentPackage,
    feature,
    description: item.description,
    requiredTier: item.requiredTier,
    upgradePath: item.requiredTier === currentPackage ? item.requiredTier : item.requiredTier,
    message: `This feature is available on the ${item.requiredTier} package or with an add-on entitlement override.`,
  };
}

async function loadTenantEntitlements(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, sector: true, package: true, featureOverrides: true },
  });
  if (!tenant) return null;
  const featureOverrides = tenant.featureOverrides || {};
  const features = resolveFeatures(tenant.package, featureOverrides);
  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    sector: tenant.sector,
    package: tenant.package,
    featureOverrides,
    features,
  };
}

function hasFeature(entitlements, feature) {
  return Boolean(entitlements?.features?.[feature]);
}

async function updateTenantPackage(tenantId, data = {}) {
  const updateData = {};
  if (data.package) updateData.package = data.package;
  if (data.featureOverrides !== undefined) updateData.featureOverrides = data.featureOverrides;
  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: updateData,
    select: { id: true, name: true, sector: true, package: true, featureOverrides: true },
  });
  return {
    ...tenant,
    features: resolveFeatures(tenant.package, tenant.featureOverrides || {}),
  };
}

module.exports = {
  loadTenantEntitlements,
  hasFeature,
  updateTenantPackage,
  buildUpgradePrompt,
};