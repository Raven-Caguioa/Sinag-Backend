// app/api/upload/route.ts
// Pinata IPFS Upload API Route

import { NextRequest, NextResponse } from "next/server";

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

export async function POST(request: NextRequest) {
  try {
    // Check for Pinata JWT
    if (!PINATA_JWT) {
      console.error("PINATA_JWT is not configured");
      return NextResponse.json(
        { error: "IPFS upload service is not configured" },
        { status: 500 }
      );
    }

    // Get the file from the request
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create FormData for Pinata
    const pinataFormData = new FormData();
    const blob = new Blob([buffer], { type: file.type });
    pinataFormData.append("file", blob, file.name);

    // Add metadata (optional but recommended)
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
      },
    });
    pinataFormData.append("pinataMetadata", metadata);

    // Pinata options
    const options = JSON.stringify({
      cidVersion: 0,
    });
    pinataFormData.append("pinataOptions", options);

    // Upload to Pinata
    const pinataResponse = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: pinataFormData,
      }
    );

    if (!pinataResponse.ok) {
      const errorData = await pinataResponse.json().catch(() => ({}));
      console.error("Pinata upload error:", errorData);
      
      return NextResponse.json(
        { 
          error: errorData.error?.details || errorData.error?.reason || "Failed to upload to IPFS" 
        },
        { status: pinataResponse.status }
      );
    }

    const pinataData = await pinataResponse.json();
    const ipfsHash = pinataData.IpfsHash;

    if (!ipfsHash) {
      return NextResponse.json(
        { error: "Invalid response from IPFS service" },
        { status: 500 }
      );
    }

    // Construct the full IPFS Gateway URL
    const ipfsUrl = `${PINATA_GATEWAY}${ipfsHash}`;

    return NextResponse.json({
      success: true,
      ipfsHash,
      ipfsUrl,
    });
  } catch (error: any) {
    console.error("Upload route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to check if Pinata is configured
export async function GET() {
  return NextResponse.json({
    configured: !!PINATA_JWT,
    gateway: PINATA_GATEWAY,
  });
}



