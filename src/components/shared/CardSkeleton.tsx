import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface CardSkeletonProps {
  count?: number;
}

const CardSkeleton = ({ count = 1 }: CardSkeletonProps) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="animate-fade-in">
          <CardHeader>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </CardContent>
        </Card>
      ))}
    </>
  );
};

export default CardSkeleton;
