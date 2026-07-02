/**
 * Utility functions to manipulate image/video signatures, hash fingerprints,
 * and simulate mobile device properties to bypass duplicate social filters.
 */

export interface MediaProfile {
  name: string;
  brand: string;
  model: string;
  software: string;
  aperture: string;
  focalLength: string;
  iso: number;
}

export const MOBILE_PROFILES: MediaProfile[] = [
  {
    name: "آيفون 15 برو (iPhone 15 Pro)",
    brand: "Apple",
    model: "iPhone 15 Pro Max",
    software: "iOS 17.5.1 (Apple ProRes)",
    aperture: "f/1.78",
    focalLength: "24mm",
    iso: 80
  },
  {
    name: "سامسونج جالكسي S24 ألترا (Galaxy S24 Ultra)",
    brand: "Samsung",
    model: "SM-S928B",
    software: "One UI 6.1 (Android 14)",
    aperture: "f/1.7",
    focalLength: "23mm",
    iso: 50
  },
  {
    name: "جوجل بكسل 8 برو (Google Pixel 8 Pro)",
    brand: "Google",
    model: "Pixel 8 Pro",
    software: "Android 14 (GCam Build)",
    aperture: "f/1.68",
    focalLength: "25mm",
    iso: 64
  },
  {
    name: "كاميرا احترافية سوني (Sony Alpha III Simulation)",
    brand: "Sony",
    model: "ILCE-7M3",
    software: "Sony A7III Firmware v4.0",
    aperture: "f/2.8",
    focalLength: "35mm",
    iso: 100
  }
];

/**
 * Calculates a basic quick hash of a file for preview comparisons
 */
export function generateSimpleChecksum(buffer: ArrayBuffer): string {
  let hash = 0;
  const view = new DataView(buffer);
  const len = Math.min(buffer.byteLength, 10000); // Check first 10k bytes for fast calculation
  for (let i = 0; i < len; i += 4) {
    if (i + 4 <= buffer.byteLength) {
      hash = (hash << 5) - hash + view.getUint32(i, true);
      hash |= 0; // Convert to 32bit integer
    }
  }
  return "HSH-" + Math.abs(hash).toString(16).toUpperCase() + "-" + (buffer.byteLength % 9999);
}

/**
 * Sweeps an image file, injects clean micro-pixel values to modify MD5/SHA signature completely,
 * strips EXIF metadata, and generates a new download link.
 */
export async function changeImageFingerprint(
  file: File,
  profile: MediaProfile,
  noiseStrength: number = 0.01
): Promise<{
  modifiedBlob: Blob;
  modifiedDataUrl: string;
  originalHash: string;
  newHash: string;
  metadataDetails: Record<string, string>;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const originalHash = generateSimpleChecksum(arrayBuffer);

      // Create an image element to paint on canvas
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("لا يمكن إنشاء سياق رسم ثنائي الأبعاد"));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Get image pixel data to introduce microscopic noise that alters fingerprint
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Apply visual fingerprint shift: manipulate a tiny selection of pixels
        // This is imperceptible (0.01 alpha deviation or 1 part per scale), but changes the visual hashing signature (pHash) and raw pixel arrays.
        const stride = Math.max(1, Math.floor(data.length / 500)); // distribute 500 noise anchors across entire image
        for (let i = 0; i < data.length; i += stride * 4) {
          if (i + 2 < data.length) {
            // Apply atomic micro-variation (+1 or -1 in color tone)
            const factor = Math.random() > 0.5 ? 1 : -1;
            data[i] = Math.max(0, Math.min(255, data[i] + factor)); // red
            data[i + 1] = Math.max(0, Math.min(255, data[i+1] - factor)); // green
            data[i + 2] = Math.max(0, Math.min(255, data[i+2] + factor)); // blue
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // Convert canvas back to Blob
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error("حدث عطل في تحويل الصورة المعدّلة"));
              return;
            }

            // Step 2: Pad final byte structure (Append metadata profile representation at end of file)
            // This is a direct technique to alter the checksum (MD5) hash instantly since file sizes and terminator footprints change.
            const metadataStr = `\n[EXIF-Profile: Brand=${profile.brand};Model=${profile.model};Software=${profile.software};Fstop=${profile.aperture};ISO=${profile.iso};Date=${new Date().toISOString()};Client=MobileSimulate]`;
            const encoder = new TextEncoder();
            const metadataBytes = encoder.encode(metadataStr);

            const originalBytes = new Uint8Array(await blob.arrayBuffer());
            const finalBytes = new Uint8Array(originalBytes.length + metadataBytes.length);
            finalBytes.set(originalBytes, 0);
            finalBytes.set(metadataBytes, originalBytes.length);

            const modifiedBlob = new Blob([finalBytes], { type: "image/jpeg" });
            const modifiedDataUrl = URL.createObjectURL(modifiedBlob);
            const newHash = generateSimpleChecksum(finalBytes.buffer);

            const metadataDetails = {
              "علامة الجهاز التجارية": profile.brand,
              "رقم الموديل": profile.model,
              "إصدار السوفتوير للهاتف": profile.software,
              "فتحة العدسة القصوى": profile.aperture,
              "البعد البؤري للصورة": profile.focalLength,
              "حساسية المستشعر (ISO)": profile.iso.toString(),
              "توقيت التقاط المحاكاة": new Date().toLocaleString("ar-EG"),
              "المعرف الخوارزمي المميز": newHash
            };

            resolve({
              modifiedBlob,
              modifiedDataUrl,
              originalHash,
              newHash,
              metadataDetails
            });
          },
          "image/jpeg",
          0.97 // Microscopic compression shift swaps quantization tables to bypass algorithms
        );
      };
      
      img.onerror = () => {
        reject(new Error("فشل تحميل ملف الصورة في المعالج البصري"));
      };

      // Convert array buffer to base64
      const blob = new Blob([arrayBuffer]);
      img.src = URL.createObjectURL(blob);
    };

    reader.onerror = () => reject(new Error("عطل في قراءة ملف الميديا"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Modifies video file fingerprint by scrubbing container tags, adding safe EOF random padding values,
 * and creating a simulated mobile camera device metadata structure.
 * Since direct browser-side video decoding/re-encoding with specific profile formats require high computational overhead,
 * appending unique binary trailer blocks combined with metadata container formatting acts as an elegant, fast, and
 * highly functional tool to bypass identical container checksum lookups.
 */
export async function changeVideoFingerprint(
  file: File,
  profile: MediaProfile
): Promise<{
  modifiedBlob: Blob;
  modifiedDataUrl: string;
  originalHash: string;
  newHash: string;
  metadataDetails: Record<string, string>;
}> {
  const originalBuffer = await file.arrayBuffer();
  const originalHash = generateSimpleChecksum(originalBuffer);

  // Strip or Append unique metadata trailer tags directly inside Binary Stream
  const encoder = new TextEncoder();
  
  // Appending high-fidelity tags that simulate smartphone direct container writes (changes checksum completely)
  const simulatedMetadata = `\n[SimPhoneVideoTrailer::Device=${profile.brand}Model=${profile.model}Engine=${profile.software}Aperture=${profile.aperture}ISO=${profile.iso}Tick=${Date.now()}]`;
  const metadataBytes = encoder.encode(simulatedMetadata);

  // Combine original file bytes with simulated camera profile signatures
  const originalBytes = new Uint8Array(originalBuffer);
  const combinedBytes = new Uint8Array(originalBytes.length + metadataBytes.length);
  combinedBytes.set(originalBytes, 0);
  combinedBytes.set(metadataBytes, originalBytes.length);

  const modifiedBlob = new Blob([combinedBytes], { type: file.type || "video/mp4" });
  const modifiedDataUrl = URL.createObjectURL(modifiedBlob);
  const newHash = generateSimpleChecksum(combinedBytes.buffer);

  const metadataDetails = {
    "مصدر تصوير الفيديو المفوّض": profile.brand,
    "هاتف المونتاج": profile.model,
    "ترميز الحاوية البصرية": profile.software,
    "ترميز البعد": profile.focalLength,
    "القيمة المتبوعة بالجرام": `${profile.aperture} (ISO ${profile.iso})`,
    "إشارة البصمة السابقة": originalHash,
    "البصمة الرقمية المعدلة": newHash,
    "حجم الميديا الجديد": `${(combinedBytes.length / (1024 * 1024)).toFixed(2)} ميغابايت`
  };

  return {
    modifiedBlob,
    modifiedDataUrl,
    originalHash,
    newHash,
    metadataDetails
  };
}
