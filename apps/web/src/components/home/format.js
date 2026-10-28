// "R$ 2.440,00" -> "R$ 2.440": whole reais read faster on a phone; cents stay when they matter.
export const trimCents = (text) => String(text).replace(/,00(?=\D*$)/, '');
