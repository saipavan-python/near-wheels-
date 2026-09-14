import Hero from "@/components/home/Hero";
import QuickActions from "@/components/home/QuickActions";
import PopularVehicles from "@/components/home/PopularVehicles";
import WhyNearWheels from "@/components/home/WhyNearWheels";
import MarketplacePreview from "@/components/home/MarketplacePreview";
import AiPreview from "@/components/home/AiPreview";
import { HowItWorks, BigCta } from "@/components/home/BigCta";
import TrustSafety from "@/components/home/TrustSafety";
import Reviews from "@/components/home/Reviews";
import YatraCta from "@/components/home/YatraCta";
import TripBudgetPlanner from "@/components/TripBudgetPlanner";

export default function Home() {
  return (
    <>
      <Hero />
      <QuickActions />
      <div className="container-nw py-6">
        <TripBudgetPlanner />
      </div>
      <PopularVehicles />
      <WhyNearWheels />
      <MarketplacePreview />
      <HowItWorks />
      <AiPreview />
      <TrustSafety />
      <Reviews />
      <YatraCta />
      <BigCta />
      <div className="container-nw pb-16 pt-14 md:pb-20" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Near Wheels",
            slogan: "Your journey. Your wheels.",
            description:
              "Premium mobility marketplace for vehicle rentals, professional drivers and trusted garages.",
          }),
        }}
      />
    </>
  );
}
