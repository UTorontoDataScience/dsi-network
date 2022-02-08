import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Autocomplete,
    Backdrop,
    capitalize,
    Fade,
    FormControl,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    SelectChangeEvent,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import { HierarchyNode } from 'd3-hierarchy';
import { DetailCard } from '../../Components';
import { groupBy, uniqueBy } from '../../util/util';
import getModel from '../../data/model';
import {
    ForceGraph,
    ForceGraphLocal,
    PackChart,
    ScrollableBarChart,
} from '../../Visualizations';
import { SelectedModel } from '../../Visualizations/ForceGraph/ForceGraphComponent';
import { getEntityId, makeTree, mapTree, stratifyFn } from '../../util';
import {
    DSINode,
    isPerson,
    isProgram,
    isResource,
    ModelEntity,
} from '../../types';
import { CloseIcon } from '../../Icons';
import { LocalDSINode } from '../../Visualizations/ForceGraph/ForceGraphLocalComponent';

const ChartPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [detailSelection, setDetailSelection] = useState<
        HierarchyNode<ModelEntity>[]
    >([]);
    const [localViewNode, setLocalViewNode] = useState<DSINode>();
    const [model, setModel] = useState<ModelEntity[]>();
    const [root, setRoot] = useState<ModelEntity>();
    const [selected, setSelected] = useState<SelectedModel[]>([]);
    const [containerWidth, setContainerWidth] = useState<number>();
    const [keywordInputString, setKeywordInputString] = useState('');
    const [selectedKeyword, setSelectedKeyword] = useState('');
    const [nameSearchInputString, setNameSearchInputString] = useState('');

    const chartContainerRef = useCallback((node: HTMLDivElement) => {
        if (node) {
            setContainerWidth(Math.min(node.clientWidth, 800));
        }
    }, []);

    useEffect(() => {
        const _getModel = async () => {
            const model = await getModel();
            setModel(model);
            setRoot(model.find(m => m.type === 'network'));
        };
        _getModel();
    }, []);

    useEffect(() => {
        const listener = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setLocalViewNode(undefined);
            }
        };
        window.addEventListener('keydown', listener);

        return () => window.removeEventListener('keydown', listener);
    }, []);

    /* 
        Base tree, which won't be used for visualizations but rather for retrieving all possible descendants of current root,
          including those not in the current graph (e.g., unselected people).
     */
    const tree0 = useMemo(() => {
        if (root && model) {
            const modelEntities = Object.values(model).flat();

            const rootModel = Object.values(model)
                .flat()
                .find(m => m.type === root.type && m.id === root.id)!;

            return makeTree(modelEntities, rootModel);
        }
    }, [model, root]);

    /* tree with selected models attached */
    const tree = useMemo(() => {
        if (tree0) {
            const selectedMap = groupBy(selected, m => `${m.type}-${m.id}`);

            const modelEntities = tree0
                .descendants()
                .map(d => d.data)
                .filter(
                    m => m.type !== 'person' || selectedMap[getEntityId(m)]
                );

            const _tree = stratifyFn(modelEntities);

            /* redundant to map, but for now an easy alternative to putting a `selected` attribute on the model itself */
            return mapTree(_tree, t => ({
                ...t,
                selected: !!selectedMap[getEntityId(t.data)],
            }));
        }
    }, [tree0, selected]);

    const getKeywords = (node: ModelEntity) =>
        isPerson(node)
            ? node.research_keywords || ''
            : isResource(node)
            ? node.keywords || ''
            : isProgram(node)
            ? node.key_words_tags || ''
            : '';

    const barChartKeywords = useMemo(() => {
        if (model) {
            const counts = Object.values(model)
                .flatMap(e =>
                    getKeywords(e)
                        .split(/[;,]/)
                        .map(d => d.trim().replace(/ +/g, ' '))
                )
                .filter(w => !!w && w.length < 40)
                .reduce<Record<string, number>>(
                    (acc, curr) => ({
                        ...acc,
                        [curr.toLowerCase()]: acc[curr.toLowerCase()]
                            ? acc[curr.toLowerCase()] + 1
                            : 1,
                    }),
                    {}
                );

            return Object.entries(counts)
                .filter(v => v[1] > 1)
                .map(([label, value]) => ({ label, value }));
        }
    }, [model]);

    const keywords = useMemo(() => {
        if (tree0) {
            const keywords = tree0
                .descendants()
                .flatMap(p => {
                    const keywords = getKeywords(p.data);
                    return keywords
                        .replace(/ +/g, ' ')
                        .split(/[,;]/)
                        .map(w => w.trim().toLowerCase());
                })
                .reduce<{ [key: string]: string[] }>(
                    (acc, curr) => ({
                        ...acc,
                        [curr]: acc[curr] ? acc[curr].concat(curr) : [curr],
                    }),
                    {}
                );

            return (
                Object.entries(keywords)
                    // filter out any singletons, which are often misspellings, whitespace-separated lists, etc.
                    .filter(a => a[1].length > 1)
                    .map(([k]) => k)
                    .filter(Boolean)
                    .sort((a, b) => (a === '' ? 1 : a < b ? -1 : 1))
            );
        }
    }, [tree0]);

    const SelectableByKeyword = useMemo(() => {
        return tree0
            ? tree0
                  .descendants()
                  .map(m => ({
                      keywords: getKeywords(m.data),
                      type: m.data.type,
                      id: m.data.id,
                  }))
                  .filter(m => !!m.keywords)
            : [];
    }, [tree0]);

    /* don't pass in nodes b/c autocomplete converts to JSON and you'll get circular errors */
    const names = useMemo(() => {
        if (tree0) {
            return tree0
                ?.descendants()
                .filter(uniqueBy(d => d.data.name))
                .map(v => v.data.name)
                .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
                .filter(Boolean);
        } else {
            return [];
        }
    }, [tree0]);

    const nameMap = useMemo(() => {
        if (model) {
            return groupBy(model, 'name');
        } else {
            return {};
        }
    }, [model]);

    const selectableRoots = useMemo(() => {
        return (model || [])
            .filter(m => ['campus', 'institution', 'network'].includes(m.type))
            .sort((a, b) =>
                a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1
            );
    }, [model]);

    const handleNodeClick = useCallback(
        (node: DSINode) => {
            if (
                node.selected &&
                detailSelection.map(d =>
                    getEntityId(d.data).includes(getEntityId(node.data))
                )
            ) {
                setLocalViewNode(node);
            } else {
                setDetailSelection(
                    tree0!
                        .descendants()
                        .filter(m => m.data.name === node.data.name)
                );
                setSelected([{ type: node.data.type, id: node.data.id }]);
            }
            setNameSearchInputString(node.data.name);
        },
        [detailSelection, tree0]
    );

    const handleKeywordSearchSelect = (value?: string) => {
        setSelectedKeyword(value || '');
        if (value) {
            setSelected(
                SelectableByKeyword.filter(p =>
                    p.keywords.toLowerCase().includes(value.toLowerCase())
                ).map(p => ({
                    type: p.type,
                    id: p.id,
                }))
            );
        }
    };

    const handleNameSearchSelect = (value?: string) => {
        if (value && tree0) {
            setDetailSelection(
                tree0!.descendants().filter(m => m.data.name === value)
            );
            setSelected(
                tree0
                    .descendants()
                    .filter(d =>
                        d.data.name.toLowerCase().includes(value.toLowerCase())
                    )
                    .flatMap(v => nameMap[v.data.name])
            );
        } else {
            setDetailSelection([]);
            setSelected([]);
        }
    };

    const handleRootSelectChange = (e: SelectChangeEvent<string>) => {
        setRoot(
            (model || []).find(
                m => e.target && getEntityId(m) === e.target.value
            )
        );
        resetKeywordInputs();
        resetNameSearchInputs();
    };

    const resetKeywordInputs = () => {
        setKeywordInputString('');
        setSelectedKeyword('');
        setDetailSelection([]);
        setSelected([]);
    };

    const resetNameSearchInputs = () => {
        setNameSearchInputString('');
        setDetailSelection([]);
        setSelected([]);
    };

    return (
        <Grid container direction="column" spacing={3}>
            <Grid item container justifyContent="center">
                <Tabs
                    value={activeTab}
                    onChange={(_, v) => {
                        setActiveTab(v);
                        if (model) {
                            setRoot(model.find(m => m.type === 'network'));
                        }
                    }}
                >
                    <Tab label="Tree View" />
                    <Tab label="Nested View" />
                    <Tab label="Scrollable Bar" />
                </Tabs>
            </Grid>
            {activeTab === 0 && (
                <Grid container direction="row" item spacing={3}>
                    <Grid
                        container
                        justifyContent="flex-end"
                        ref={chartContainerRef}
                        item
                        xs={9}
                    >
                        {tree && containerWidth && (
                            <ForceGraph
                                containerWidth={containerWidth}
                                onNodeClick={handleNodeClick}
                                tree={tree}
                            />
                        )}
                    </Grid>
                    <Grid item xs={3} container direction="column" spacing={5}>
                        <Grid container direction="column" item spacing={2}>
                            <Grid item>
                                <FormControl fullWidth>
                                    <InputLabel htmlFor="root">Root</InputLabel>
                                    <Select
                                        id="root"
                                        onChange={handleRootSelectChange}
                                        value={root ? getEntityId(root) : ''}
                                    >
                                        {selectableRoots.map(m => (
                                            <MenuItem
                                                key={m.name}
                                                value={getEntityId(m)}
                                            >
                                                <Typography>
                                                    {m.name}
                                                </Typography>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item>
                                <FormControl fullWidth>
                                    {tree0 && tree && (
                                        <ChartPageAutocomplete
                                            label="Search by name or program"
                                            getOptionLabel={m => capitalize(m)}
                                            inputValue={nameSearchInputString}
                                            onInputChange={(value: string) => {
                                                setNameSearchInputString(value);
                                                resetKeywordInputs();
                                                if (!value) {
                                                    setSelected([]);
                                                }
                                            }}
                                            onSelect={handleNameSearchSelect}
                                            options={names}
                                            tree={tree}
                                            value={nameSearchInputString}
                                        />
                                    )}
                                </FormControl>
                            </Grid>
                            <Grid item>
                                <FormControl fullWidth>
                                    {tree && keywords && (
                                        <ChartPageAutocomplete
                                            getOptionLabel={o => capitalize(o)}
                                            inputValue={keywordInputString}
                                            label="Search by keyword"
                                            onInputChange={(value: string) => {
                                                setKeywordInputString(value);
                                                resetNameSearchInputs();
                                                if (!value) {
                                                    setSelected([]);
                                                }
                                            }}
                                            onSelect={handleKeywordSearchSelect}
                                            options={keywords}
                                            tree={tree}
                                            value={selectedKeyword}
                                        />
                                    )}
                                </FormControl>
                            </Grid>
                        </Grid>
                        <Grid item>
                            {!!detailSelection.length && (
                                <DetailCard nodes={detailSelection} />
                            )}
                        </Grid>
                    </Grid>
                </Grid>
            )}
            {activeTab === 1 && (
                <Grid container justifyContent="center" sx={{ marginTop: 3 }}>
                    {model && <PackChart entities={model} />}
                </Grid>
            )}
            {activeTab === 2 && (
                <Grid container justifyContent="center" sx={{ marginTop: 3 }}>
                    {barChartKeywords && (
                        <ScrollableBarChart data={barChartKeywords} />
                    )}
                </Grid>
            )}
            {tree0 && !!localViewNode && (
                <LocalView
                    tree={tree0}
                    nodeId={getEntityId(localViewNode.data)}
                    onClose={() => {
                        setLocalViewNode(undefined);
                    }}
                    resetViewNode={n => setLocalViewNode(n)}
                />
            )}
        </Grid>
    );
};

interface ChartPageAutocompleteProps {
    getOptionLabel?: (option: string) => string;
    inputValue: string;
    onInputChange: (item: string) => void;
    onSelect?: (item?: string) => void;
    options: string[];
    label: string;
    tree: DSINode;
    value: string;
}

const ChartPageAutocomplete: React.FC<ChartPageAutocompleteProps> = ({
    getOptionLabel,
    inputValue,
    onInputChange,
    onSelect,
    options,
    label,
    tree,
    value,
}) => (
    <Autocomplete
        key={tree?.id}
        clearOnEscape
        freeSolo
        getOptionLabel={getOptionLabel}
        inputValue={inputValue}
        isOptionEqualToValue={(o, v) => o === v}
        onChange={(_, value, reason) => {
            if (onSelect) {
                if (reason === 'selectOption' && value) {
                    onSelect(value);
                }
                if (reason === 'clear') {
                    onSelect(undefined);
                }
            }
        }}
        onInputChange={(_, value) => onInputChange(value)}
        options={options}
        renderInput={params => <TextField {...params} label={label} />}
        value={value}
    />
);

export default ChartPage;

interface LocalViewProps {
    nodeId: string;
    resetViewNode: (node: LocalDSINode) => void;
    onClose: () => void;
    tree: DSINode;
}

const LocalView: React.FC<LocalViewProps> = ({
    nodeId,
    onClose,
    resetViewNode,
    tree,
}) => (
    <Fade timeout={500} in={true}>
        <Backdrop sx={{ zIndex: 20, opacity: 0.9 }} open={true}>
            <Paper sx={{ flexGrow: 1, padding: 15 }}>
                <IconButton
                    disableFocusRipple={true}
                    disableRipple={true}
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        width: '5%',
                    }}
                >
                    <CloseIcon />
                </IconButton>
                <ForceGraphLocal
                    resetViewNode={resetViewNode}
                    selectedNodeId={nodeId}
                    tree={tree.copy()}
                />
            </Paper>
        </Backdrop>
    </Fade>
);
