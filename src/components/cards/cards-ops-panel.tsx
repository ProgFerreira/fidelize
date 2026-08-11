"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Link2,
  Loader2,
  PackagePlus,
  Printer,
  Settings2,
  Smartphone,
} from "lucide-react";
import { Button, Input, Label, Select } from "@/components/ui";
import { toast } from "@/components/ui/toast-provider";
import {
  createCardStockAction,
  issueVirtualCardAction,
  linkCardAction,
  saveCardSettingsAction,
  searchPatientsForCardAction,
} from "@/app/actions";
import { CardQrScanner } from "@/components/cards/card-qr-scanner";

type UnitOption = { id: string; name: string };
type CardSettingsDTO = {
  prefix: string;
  lowStockThreshold: number;
  defaultValidityDays: number | null;
};

type PatientHit = {
  id: string;
  fullName: string;
  walletId: string;
};

export function CardsOpsPanel({
  units,
  settings,
  availableCards,
}: {
  units: UnitOption[];
  settings: CardSettingsDTO;
  availableCards: Array<{ id: string; cardNumber: string; publicToken: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [patientQuery, setPatientQuery] = React.useState("");
  const [patientHits, setPatientHits] = React.useState<PatientHit[]>([]);
  const [selectedPatient, setSelectedPatient] = React.useState<PatientHit | null>(
    null,
  );
  const [virtualPatientQuery, setVirtualPatientQuery] = React.useState("");
  const [virtualHits, setVirtualHits] = React.useState<PatientHit[]>([]);
  const [virtualPatient, setVirtualPatient] = React.useState<PatientHit | null>(
    null,
  );

  React.useEffect(() => {
    if (patientQuery.trim().length < 2) {
      setPatientHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await searchPatientsForCardAction(patientQuery);
      if (res.ok) setPatientHits(res.results);
    }, 250);
    return () => clearTimeout(t);
  }, [patientQuery]);

  React.useEffect(() => {
    if (virtualPatientQuery.trim().length < 2) {
      setVirtualHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await searchPatientsForCardAction(virtualPatientQuery);
      if (res.ok) setVirtualHits(res.results);
    }, 250);
    return () => clearTimeout(t);
  }, [virtualPatientQuery]);

  async function onStock(formData: FormData) {
    setBusy("stock");
    try {
      const res = await createCardStockAction(formData);
      if (!res.ok) {
        toast.error("Estoque", res.error);
        return;
      }
      toast.success("Estoque gerado", `${res.count} cartão(ões)`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onSettings(formData: FormData) {
    setBusy("settings");
    try {
      const res = await saveCardSettingsAction(formData);
      if (!res.ok) {
        toast.error("Configurações", res.error);
        return;
      }
      toast.success("Configurações salvas");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error("Vínculo", "Selecione um paciente");
      return;
    }
    setBusy("link");
    try {
      const fd = new FormData();
      fd.set("publicToken", token);
      fd.set("walletId", selectedPatient.walletId);
      const res = await linkCardAction(fd);
      if (!res.ok) {
        toast.error("Vínculo", res.error);
        return;
      }
      toast.success("Cartão vinculado", selectedPatient.fullName);
      setToken("");
      setSelectedPatient(null);
      setPatientQuery("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onVirtual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!virtualPatient) {
      toast.error("Virtual", "Selecione um paciente");
      return;
    }
    setBusy("virtual");
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("walletId", virtualPatient.walletId);
      const res = await issueVirtualCardAction(fd);
      if (!res.ok) {
        toast.error("Virtual", res.error);
        return;
      }
      toast.success("Cartão virtual emitido", res.cardNumber);
      setVirtualPatient(null);
      setVirtualPatientQuery("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="cartoes-ops">
      <div className="cartoes-panel">
        <div className="cartoes-panel__head">
          <div>
            <h2 className="cartoes-panel__title">Gerar estoque físico</h2>
            <p className="cartoes-panel__desc">
              Cria cartões com número sequencial e token seguro no QR.
            </p>
          </div>
          <PackagePlus className="cartoes-panel__icon" aria-hidden />
        </div>
        <form action={onStock} className="cartoes-stock-form cartoes-stock-form--wide">
          <div>
            <Label htmlFor="stock-qty">Quantidade</Label>
            <Input
              id="stock-qty"
              name="quantity"
              type="number"
              min={1}
              max={500}
              defaultValue={10}
              required
            />
          </div>
          <div>
            <Label htmlFor="stock-prefix">Prefixo</Label>
            <Input
              id="stock-prefix"
              name="prefix"
              defaultValue={settings.prefix}
              maxLength={8}
            />
          </div>
          <div>
            <Label htmlFor="stock-validity">Validade (dias)</Label>
            <Input
              id="stock-validity"
              name="validityDays"
              type="number"
              min={1}
              placeholder={
                settings.defaultValidityDays
                  ? String(settings.defaultValidityDays)
                  : "Sem validade"
              }
            />
          </div>
          <div>
            <Label htmlFor="stock-unit">Unidade</Label>
            <Select id="stock-unit" name="unitId" defaultValue="">
              <option value="">Estoque geral</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="cartoes-stock-form__action">
            <Button type="submit" variant="gold" disabled={busy === "stock"}>
              {busy === "stock" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <PackagePlus className="h-4 w-4" aria-hidden />
              )}
              Gerar lote
            </Button>
          </div>
        </form>
        <div className="cartoes-panel__actions">
          <Link href="/cartoes/imprimir?status=AVAILABLE">
            <Button type="button" variant="contorno">
              <Printer className="h-4 w-4" aria-hidden />
              Imprimir QR disponíveis
            </Button>
          </Link>
        </div>
      </div>

      <div className="cartoes-ops__grid">
        <div className="cartoes-panel">
          <div className="cartoes-panel__head">
            <div>
              <h2 className="cartoes-panel__title">Vínculo rápido</h2>
              <p className="cartoes-panel__desc">
                Associe um cartão disponível a um paciente (físico).
              </p>
            </div>
            <Link2 className="cartoes-panel__icon" aria-hidden />
          </div>
          <form onSubmit={onLink} className="cartoes-link-form">
            <div>
              <Label htmlFor="link-token">Token / QR</Label>
              <div className="cartoes-link-form__token">
                <Input
                  id="link-token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  list="available-tokens"
                  placeholder="Cole o token ou escolha abaixo"
                  required
                />
                <Button
                  type="button"
                  variant="contorno"
                  onClick={() => setScannerOpen(true)}
                  aria-label="Ler QR com a câmera"
                >
                  <Camera className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <datalist id="available-tokens">
                {availableCards.slice(0, 40).map((c) => (
                  <option key={c.id} value={c.publicToken}>
                    {c.cardNumber}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="link-patient">Paciente</Label>
              <Input
                id="link-patient"
                value={selectedPatient?.fullName ?? patientQuery}
                onChange={(e) => {
                  setSelectedPatient(null);
                  setPatientQuery(e.target.value);
                }}
                placeholder="Nome, CPF ou telefone"
                required
              />
              {patientHits.length > 0 && !selectedPatient ? (
                <ul className="cartoes-typeahead">
                  {patientHits.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientQuery(p.fullName);
                          setPatientHits([]);
                        }}
                      >
                        {p.fullName}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <Button type="submit" disabled={busy === "link"}>
              {busy === "link" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Vincular
            </Button>
          </form>
        </div>

        <div className="cartoes-panel">
          <div className="cartoes-panel__head">
            <div>
              <h2 className="cartoes-panel__title">Cartão virtual</h2>
              <p className="cartoes-panel__desc">
                Emite QR digital sem consumir estoque físico. Pode coexistir com
                o cartão físico.
              </p>
            </div>
            <Smartphone className="cartoes-panel__icon" aria-hidden />
          </div>
          <form onSubmit={onVirtual} className="cartoes-link-form">
            <div>
              <Label htmlFor="virtual-patient">Paciente</Label>
              <Input
                id="virtual-patient"
                value={virtualPatient?.fullName ?? virtualPatientQuery}
                onChange={(e) => {
                  setVirtualPatient(null);
                  setVirtualPatientQuery(e.target.value);
                }}
                placeholder="Nome, CPF ou telefone"
                required
              />
              {virtualHits.length > 0 && !virtualPatient ? (
                <ul className="cartoes-typeahead">
                  {virtualHits.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setVirtualPatient(p);
                          setVirtualPatientQuery(p.fullName);
                          setVirtualHits([]);
                        }}
                      >
                        {p.fullName}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div>
              <Label htmlFor="virtual-validity">Validade (dias)</Label>
              <Input
                id="virtual-validity"
                name="validityDays"
                type="number"
                min={1}
                placeholder="Opcional"
              />
            </div>
            <Button type="submit" variant="gold" disabled={busy === "virtual"}>
              Emitir virtual
            </Button>
          </form>
        </div>

        <div className="cartoes-panel">
          <div className="cartoes-panel__head">
            <div>
              <h2 className="cartoes-panel__title">Configurações</h2>
              <p className="cartoes-panel__desc">
                Prefixo padrão, alerta de estoque baixo e validade sugerida.
              </p>
            </div>
            <Settings2 className="cartoes-panel__icon" aria-hidden />
          </div>
          <form action={onSettings} className="cartoes-link-form">
            <div>
              <Label htmlFor="cfg-prefix">Prefixo padrão</Label>
              <Input
                id="cfg-prefix"
                name="prefix"
                defaultValue={settings.prefix}
                maxLength={8}
                required
              />
            </div>
            <div>
              <Label htmlFor="cfg-stock">Alerta estoque baixo</Label>
              <Input
                id="cfg-stock"
                name="lowStockThreshold"
                type="number"
                min={1}
                defaultValue={settings.lowStockThreshold}
                required
              />
            </div>
            <div>
              <Label htmlFor="cfg-validity">Validade padrão (dias)</Label>
              <Input
                id="cfg-validity"
                name="defaultValidityDays"
                type="number"
                min={1}
                defaultValue={settings.defaultValidityDays ?? ""}
                placeholder="Vazio = sem validade"
              />
            </div>
            <Button type="submit" variant="contorno" disabled={busy === "settings"}>
              Salvar
            </Button>
          </form>
        </div>
      </div>

      {scannerOpen ? (
        <CardQrScanner
          onDetected={(value) => {
            setToken(value);
            setScannerOpen(false);
            toast.success("QR lido");
          }}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}
    </div>
  );
}
