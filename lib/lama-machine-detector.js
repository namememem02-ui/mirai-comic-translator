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

const path = require('path');

const DEFAULT_MINIMUM_DRIVER = '522.06';

function parseNvidiaSmi(stdout) {
  if (typeof stdout !== 'string' || stdout.length === 0 || stdout.length > MAX_OUTPUT_LENGTH) return null;
  const line = stdout.split(/\r?\n/, 1)[0];
  const values = line.split(',').map((value) => value.trim());
  if (values.length !== 2 || values[0].length === 0 || values[0].length > 200 || !isBoundedDriverVersion(values[1])) return null;
  return { name: values[0], driverVersion: values[1] };
}

function unavailable(reason) {
  return { present: false, name: '', driverVersion: '', compatible: false, reason };
}

function safeFreeBytes(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function wrapExecFile(fn) {
  if (typeof fn !== 'function') throw new TypeError('execFile is required');
  return (file, args, options) => {
    try {
      const res = fn(file, args, options);
      if (res && typeof res.then === 'function') return res;
    } catch (err) {
      if (err && err.code !== 'ERR_INVALID_ARG_TYPE') throw err;
    }
    return new Promise((resolve, reject) => {
      fn(file, args, options, (err, stdout, stderr) => {
        if (err) return reject(err);
        resolve({ stdout: stdout || '', stderr: stderr || '' });
      });
    });
  };
}

function createLamaMachineDetector({ execFile: rawExecFile, platform, arch, freeDisk, componentContract } = {}) {
  const execFile = wrapExecFile(rawExecFile);
  if (typeof freeDisk !== 'function') throw new TypeError('freeDisk is required');
  const minimumDriver = nvidiaMinimumDriver(componentContract) || DEFAULT_MINIMUM_DRIVER;

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

      let candidateCmds = ['nvidia-smi'];
      if (process.env.SystemRoot) {
        candidateCmds.push(path.join(process.env.SystemRoot, 'System32', 'nvidia-smi.exe'));
      }
      if (process.env['ProgramFiles']) {
        candidateCmds.push(path.join(process.env['ProgramFiles'], 'NVIDIA Corporation', 'NVSMI', 'nvidia-smi.exe'));
      }

      let output = null;
      for (const cmdPath of candidateCmds) {
        try {
          output = await execFile(cmdPath, [
            '--query-gpu=name,driver_version',
            '--format=csv,noheader',
          ], { timeout: NVIDIA_SMI_TIMEOUT_MS, windowsHide: true });
          if (output && output.stdout) break;
        } catch {}
      }

      if (!output || !output.stdout) {
        result.nvidia = unavailable('not-detected');
        return result;
      }

      const parsed = parseNvidiaSmi(output.stdout);
      if (!parsed) {
        result.nvidia = unavailable('invalid-output');
        return result;
      }

      const isCompatible = compareDriverVersions(parsed.driverVersion, minimumDriver) >= 0;
      result.nvidia = {
        present: true,
        name: parsed.name,
        driverVersion: parsed.driverVersion,
        compatible: isCompatible,
        reason: isCompatible ? 'supported' : 'driver-too-old',
      };
      return result;
    },
  };
}

module.exports = { createLamaMachineDetector };
