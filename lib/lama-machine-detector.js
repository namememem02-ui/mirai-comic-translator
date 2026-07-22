const { validateComponentManifest } = require('./lama-component-contract');

const DRIVER_PATTERN = /^\d+(?:\.\d+){1,3}$/;
const MAX_OUTPUT_LENGTH = 16 * 1024;
const MAX_DRIVER_COMPONENT_LENGTH = 12;
const NVIDIA_SMI_TIMEOUT_MS = 3000;

function isBoundedDriverVersion(value) {
  if (typeof value !== 'string' || !DRIVER_PATTERN.test(value)) return false;
  return value.split('.').every((component) => component.length <= MAX_DRIVER_COMPONENT_LENGTH);
}

function normalizedDriverComponent(component) {
  const normalized = component.replace(/^0+/, '');
  return normalized || '0';
}

function compareDriverVersions(left, right) {
  const leftParts = left.split('.').map(normalizedDriverComponent);
  const rightParts = right.split('.').map(normalizedDriverComponent);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || '0';
    const rightPart = rightParts[index] || '0';
    if (leftPart.length !== rightPart.length) return leftPart.length - rightPart.length;
    if (leftPart !== rightPart) return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

function nvidiaMinimumDriver(contract) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) return '';
  try {
    const manifest = validateComponentManifest(contract);
    const nvidiaPackage = manifest.packages.find((entry) => entry.backend === 'nvidia');
    return nvidiaPackage && isBoundedDriverVersion(nvidiaPackage.minDriver) ? nvidiaPackage.minDriver : '';
  } catch {
    return '';
  }
}

function parseNvidiaSmi(stdout) {
  if (typeof stdout !== 'string' || stdout.length === 0 || stdout.length > MAX_OUTPUT_LENGTH) return null;
  const line = stdout.split(/\r?\n/, 1)[0];
  const values = line.split(',').map((value) => value.trim());
  if (values.length !== 2 || values[0].length === 0 || values[0].length > 200 || !isBoundedDriverVersion(values[1])) return null;
  return values[1];
}

function unavailable(reason) {
  return { present: false, driverVersion: '', compatible: false, reason };
}

function safeFreeBytes(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function createLamaMachineDetector({ execFile, platform, arch, freeDisk, componentContract } = {}) {
  if (typeof execFile !== 'function') throw new TypeError('execFile is required');
  if (typeof freeDisk !== 'function') throw new TypeError('freeDisk is required');
  const minimumDriver = nvidiaMinimumDriver(componentContract);

  return {
    async detect(componentRoot) {
      let freeBytes = 0;
      try {
        freeBytes = safeFreeBytes(await freeDisk(componentRoot));
      } catch {
        // Disk-probe failures are intentionally not surfaced to the renderer.
      }

      const result = { platform, arch, freeBytes, nvidia: unavailable('unsupported-platform') };
      if (platform !== 'win32' || arch !== 'x64') return result;

      let output;
      try {
        output = await execFile('nvidia-smi', [
          '--query-gpu=name,driver_version',
          '--format=csv,noheader',
        ], { timeout: NVIDIA_SMI_TIMEOUT_MS, windowsHide: true });
      } catch {
        result.nvidia = unavailable('not-detected');
        return result;
      }

      const driverVersion = parseNvidiaSmi(output && output.stdout);
      if (!driverVersion) {
        result.nvidia = unavailable('invalid-output');
        return result;
      }

      if (!minimumDriver) {
        result.nvidia = { present: true, driverVersion, compatible: false, reason: 'min-driver-unavailable' };
        return result;
      }
      result.nvidia = compareDriverVersions(driverVersion, minimumDriver) >= 0
        ? { present: true, driverVersion, compatible: true, reason: 'supported' }
        : { present: true, driverVersion, compatible: false, reason: 'driver-too-old' };
      return result;
    },
  };
}

module.exports = { createLamaMachineDetector };
