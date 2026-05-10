-- CreateTable
CREATE TABLE "_UserWishlists" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserWishlists_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_UserWishlists_B_index" ON "_UserWishlists"("B");

-- AddForeignKey
ALTER TABLE "_UserWishlists" ADD CONSTRAINT "_UserWishlists_A_fkey" FOREIGN KEY ("A") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserWishlists" ADD CONSTRAINT "_UserWishlists_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
