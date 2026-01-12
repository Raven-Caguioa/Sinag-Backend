"use client";

import { useState } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { PlusCircle, Loader2, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { 
  PACKAGE_ID, 
  ADMIN_CAP, 
  REGISTRY, 
  SUI_CLOCK,
  ERROR_MESSAGES,
  MAX_IMAGES 
} from "@/lib/constants";
import { 
  suiToMist, 
  usdcToMicro, 
  percentToBps, 
  isValidUrl,
  waitForTransaction 
} from "@/lib/utils";

type CoinType = "SUI" | "USDC";

export default function CreateCampaign() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [coinType, setCoinType] = useState<CoinType>("SUI");
  const [loading, setLoading] = useState(false);
  const [txDigest, setTxDigest] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    target_apy: "",
    maturity_days: "",
    structure: "",
    price_per_share: "",
    total_supply: "",
    resort_images: [""],
    nft_image: "",
    due_diligence_url: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleResortImageChange = (index: number, url: string) => {
    const newImages = [...formData.resort_images];
    newImages[index] = url;
    setFormData((prev) => ({ ...prev, resort_images: newImages }));
  };

  const addImageField = () => {
    if (formData.resort_images.length < MAX_IMAGES) {
      setFormData((prev) => ({
        ...prev,
        resort_images: [...prev.resort_images, ""],
      }));
    }
  };

  const removeImageField = (index: number) => {
    if (formData.resort_images.length > 1) {
      const newImages = formData.resort_images.filter((_, i) => i !== index);
      setFormData((prev) => ({ ...prev, resort_images: newImages }));
    }
  };

  const validateForm = (): boolean => {
    if (!account) {
      setError(ERROR_MESSAGES.NO_WALLET);
      return false;
    }

    if (!formData.name || !formData.description || !formData.location) {
      setError("Please fill in all required fields");
      return false;
    }

    const apy = parseFloat(formData.target_apy);
    if (isNaN(apy) || apy <= 0 || apy > 100) {
      setError("APY must be between 0 and 100%");
      return false;
    }

    const days = parseInt(formData.maturity_days);
    if (isNaN(days) || days < 1) {
      setError(ERROR_MESSAGES.INVALID_MATURITY);
      return false;
    }

    const price = parseFloat(formData.price_per_share);
    if (isNaN(price) || price <= 0) {
      setError("Price per share must be greater than 0");
      return false;
    }

    const supply = parseInt(formData.total_supply);
    if (isNaN(supply) || supply < 1) {
      setError("Total supply must be at least 1");
      return false;
    }

    const validImages = formData.resort_images.filter((img) => img.trim() !== "");
    if (validImages.length === 0) {
      setError(ERROR_MESSAGES.INVALID_IMAGES);
      return false;
    }

    if (validImages.length > MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images allowed`);
      return false;
    }

    if (!formData.nft_image.trim()) {
      setError("Please provide an NFT image");
      return false;
    }

    // Validate that all images are valid IPFS URLs (should start with https://gateway or http://ipfs)
    for (const img of validImages) {
      if (!isValidUrl(img) || (!img.includes("ipfs") && !img.startsWith("http"))) {
        setError("All resort images must be valid IPFS URLs");
        return false;
      }
    }

    if (!isValidUrl(formData.nft_image) || (!formData.nft_image.includes("ipfs") && !formData.nft_image.startsWith("http"))) {
      setError("NFT image must be a valid IPFS URL");
      return false;
    }

    if (formData.due_diligence_url && !isValidUrl(formData.due_diligence_url)) {
      setError("Invalid due diligence URL format");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError("");
    setTxDigest("");

    try {
      const tx = new Transaction();

      const apyBps = percentToBps(parseFloat(formData.target_apy));
      const priceInSmallestUnit = coinType === "SUI" 
        ? suiToMist(parseFloat(formData.price_per_share))
        : usdcToMicro(parseFloat(formData.price_per_share));

      const validImages = formData.resort_images.filter((img) => img.trim() !== "");

      // Build arguments matching the Move contract signature exactly:
      // create_campaign_sui(admin, registry, name, description, location, target_apy, maturity_days, 
      //                    structure, price_per_share, total_supply, resort_images, nft_image, due_diligence_url, clock)
      // Note: Contract expects vector<u8> for strings and vector<vector<u8>> for string arrays
      // Sui SDK v1 tx.pure() with BCS serialization ensures correct byte serialization
      const args = [
        tx.object(ADMIN_CAP),
        tx.object(REGISTRY),
        tx.pure(bcs.string().serialize(formData.name).toBytes()), // vector<u8> (name)
        tx.pure(bcs.string().serialize(formData.description).toBytes()), // vector<u8> (description)
        tx.pure(bcs.string().serialize(formData.location).toBytes()), // vector<u8> (location)
        tx.pure.u64(apyBps), // u64 (target_apy in basis points: 10% = 1000 bps)
        tx.pure.u64(parseInt(formData.maturity_days)), // u64 (maturity_days)
        tx.pure(bcs.string().serialize(formData.structure).toBytes()), // vector<u8> (structure)
        tx.pure.u64(priceInSmallestUnit), // u64 (price_per_share in MIST for SUI or micro-USDC for USDC)
        tx.pure.u64(parseInt(formData.total_supply)), // u64 (total_supply)
        tx.pure(bcs.vector(bcs.string()).serialize(validImages).toBytes()), // vector<vector<u8>> (resort_images - IPFS URLs)
        tx.pure(bcs.string().serialize(formData.nft_image).toBytes()), // vector<u8> (nft_image - IPFS URL)
        formData.due_diligence_url.trim()
          ? tx.pure(bcs.option(bcs.string()).serialize(formData.due_diligence_url.trim()).toBytes()) // Option<vector<u8>>
          : tx.pure(bcs.option(bcs.string()).serialize(null).toBytes()), // Option<vector<u8>> (None)
        tx.object(SUI_CLOCK), // Clock object reference
      ];

      if (coinType === "SUI") {
        tx.moveCall({
          target: `${PACKAGE_ID}::campaign::create_campaign_sui`,
          arguments: args,
        });
      } else {
        const USDC_TYPE = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";
        
        tx.moveCall({
          target: `${PACKAGE_ID}::campaign::create_campaign_usdc`,
          arguments: args,
          typeArguments: [USDC_TYPE],
        });
      }

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            setTxDigest(result.digest);
            
            try {
              await waitForTransaction(client, result.digest);
              alert("Campaign created successfully!");
              
              setFormData({
                name: "",
                description: "",
                location: "",
                target_apy: "",
                maturity_days: "",
                structure: "",
                price_per_share: "",
                total_supply: "",
                resort_images: [""],
                nft_image: "",
                due_diligence_url: "",
              });
            } catch (confirmError) {
              console.error("Confirmation error:", confirmError);
            }
            
            setLoading(false);
          },
          onError: (error) => {
            console.error("Transaction error:", error);
            setError(error.message || ERROR_MESSAGES.TRANSACTION_FAILED);
            setLoading(false);
          },
        }
      );
    } catch (err: any) {
      console.error("Error creating campaign:", err);
      setError(err.message || ERROR_MESSAGES.TRANSACTION_FAILED);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-slate-900 dark:text-white mb-2">
          Create Campaign
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Launch a new resort funding campaign on Sinag Protocol
        </p>
      </div>

      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          Payment Token
        </label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setCoinType("SUI")}
            className={`flex-1 p-4 rounded-xl border-2 transition-all ${
              coinType === "SUI"
                ? "border-blue-500 dark:border-[#D4AF37] bg-blue-50 dark:bg-[#D4AF37]/10"
                : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
            }`}
          >
            <div className="text-center">
              <p className="font-semibold text-slate-900 dark:text-white">SUI</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Native token
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setCoinType("USDC")}
            className={`flex-1 p-4 rounded-xl border-2 transition-all ${
              coinType === "USDC"
                ? "border-blue-500 dark:border-[#D4AF37] bg-blue-50 dark:bg-[#D4AF37]/10"
                : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
            }`}
          >
            <div className="text-center">
              <p className="font-semibold text-slate-900 dark:text-white">USDC</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Stablecoin
              </p>
            </div>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Basic Information
          </h2>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Campaign Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
              placeholder="The Azure Palawan"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
              placeholder="Luxury beachfront resort development..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Location *
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleInputChange("location", e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
              placeholder="El Nido, Philippines"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Structure *
            </label>
            <input
              type="text"
              value={formData.structure}
              onChange={(e) => handleInputChange("structure", e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
              placeholder="Asset-Backed, Guaranteed Yield, etc."
            />
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Financial Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Target APY (%) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.target_apy}
                onChange={(e) => handleInputChange("target_apy", e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
                placeholder="18.5"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Annual Percentage Yield
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Maturity Days *
              </label>
              <input
                type="number"
                value={formData.maturity_days}
                onChange={(e) => handleInputChange("maturity_days", e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
                placeholder="365"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Duration in days
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Price per Share ({coinType}) *
              </label>
              <input
                type="number"
                step="0.000001"
                value={formData.price_per_share}
                onChange={(e) => handleInputChange("price_per_share", e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
                placeholder="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Total Supply (shares) *
              </label>
              <input
                type="number"
                value={formData.total_supply}
                onChange={(e) => handleInputChange("total_supply", e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
                placeholder="10000"
              />
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Media & Documents
          </h2>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Resort Images * (Upload to IPFS)
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Upload at least 1 and up to {MAX_IMAGES} resort images. Images will be uploaded to IPFS.
            </p>
            <div className="space-y-4">
              {formData.resort_images.map((image, index) => (
                <div key={index} className="relative">
                  <ImageUpload
                    value={image}
                    onChange={(url) => handleResortImageChange(index, url)}
                    label={`Resort Image ${index + 1}`}
                    required={index === 0}
                    maxSizeMB={10}
                  />
                  {formData.resort_images.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeImageField(index)}
                      className="absolute -top-2 -right-2 p-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg z-10"
                      title="Remove image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {formData.resort_images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={addImageField}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-sm font-medium"
              >
                <PlusCircle className="w-4 h-4" />
                Add another image
              </button>
            )}
          </div>

          <div>
            <ImageUpload
              value={formData.nft_image}
              onChange={(url) => handleInputChange("nft_image", url)}
              label="NFT Image (Upload to IPFS) *"
              required={true}
              maxSizeMB={10}
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              This image will be used for the NFT share tokens. Upload to IPFS.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Due Diligence Document URL (Optional)
            </label>
            <input
              type="url"
              value={formData.due_diligence_url}
              onChange={(e) => handleInputChange("due_diligence_url", e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
              placeholder="https://example.com/due-diligence.pdf"
            />
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {txDigest && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                Campaign created successfully!
            </p>
            <a
                href={`https://suiexplorer.com/txblock/${txDigest}?network=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 dark:text-green-400 hover:underline font-mono"
            >
                View transaction: {txDigest.slice(0, 20)}...
            </a>
            </div>
        </div>
        )}

        <button
          type="submit"
          disabled={loading || !account}
          className="w-full py-4 rounded-xl bg-slate-900 dark:bg-[#D4AF37] text-white dark:text-black font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Campaign...
            </>
          ) : (
            <>
              <PlusCircle className="w-5 h-5" />
              Create Campaign
            </>
          )}
        </button>
      </form>
    </div>
  );
}