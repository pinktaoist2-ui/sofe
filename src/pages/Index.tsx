import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Cake, Clock, Heart } from "lucide-react";
import Navbar from "@/components/Navbar";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/20 to-background">
      <Navbar />
      
      <main>
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="inline-block">
              <div className="bg-gradient-to-br from-primary to-accent p-4 rounded-2xl shadow-elegant">
                <Cake className="h-16 w-16 text-white" />
              </div>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Tiffany's Delight
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Handcrafted pastries made with love, fresh daily. Experience the perfect blend of tradition and innovation in every bite.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/shop">
                <Button size="lg" className="gap-2">
                  Browse Our Pastries <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center space-y-4 p-6 rounded-xl bg-card border hover:shadow-elegant transition-shadow">
              <div className="inline-flex p-3 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full">
                <Cake className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Freshly Baked</h3>
              <p className="text-muted-foreground">
                All our pastries are baked fresh daily using premium ingredients
              </p>
            </div>
            
            <div className="text-center space-y-4 p-6 rounded-xl bg-card border hover:shadow-elegant transition-shadow">
              <div className="inline-flex p-3 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Made with Love</h3>
              <p className="text-muted-foreground">
                Each pastry is crafted with care and attention to detail
              </p>
            </div>
            
            <div className="text-center space-y-4 p-6 rounded-xl bg-card border hover:shadow-elegant transition-shadow">
              <div className="inline-flex p-3 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Quick Delivery</h3>
              <p className="text-muted-foreground">
                Fast and reliable delivery right to your doorstep
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
