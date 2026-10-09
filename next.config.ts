import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ข้อมูลทั้งหมดอ่านจากไฟล์ใน repo ตอน build → ทุกหน้าเป็น static
  outputFileTracingIncludes: { "/**": ["./data/**/*"] },
};

export default nextConfig;
